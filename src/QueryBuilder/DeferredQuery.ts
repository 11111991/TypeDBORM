import { DbContext } from "../Data/DBContext";
import { IQueryResult } from "./IQueryResult";
import { IQueryCommandExpression } from "../Queryable/QueryExpression/IQueryCommandExpression";
import { ISqlParameter } from "./ISqlParameter";
import { QueryBuilder } from "./QueryBuilder";
import { IQuery } from "./Interface/IQuery";
import { Diagnostic } from "../Logger/Diagnostic";
import { hashCode, isNotNull } from "../Helper/Util";
import { ISaveChangesOption } from "./Interface/IQueryOption";
import { ValueExpression } from "../ExpressionBuilder/Expression/ValueExpression";
import { InsertExpression } from "../Queryable/QueryExpression/InsertExpression";
import { QueryType } from "../Common/Type";
import { IExpression } from "../ExpressionBuilder/Expression/IExpression";

export class DeferredQuery<T = any> {
    public value: T;
    public resolver: (value?: T | PromiseLike<T>) => void;
    private _queryies: IQuery[] = [];
    public get queries() {
        return this._queryies.slice();
    }
    public options: ISaveChangesOption;
    constructor(protected readonly dbContext: DbContext, public readonly command: IQueryCommandExpression, public readonly parameters: ISqlParameter[], public readonly resultParser: (result: IQueryResult[], queryCommands?: IQuery[]) => T, options?: ISaveChangesOption) {
        this.options = {};
        if (options) {
            Object.assign(this.options, options);
        }
    }
    public resolve(result: IQueryResult[]) {
        this.value = this.resultParser(result, this._queryies);
        if (this.resolver) {
            this.resolver(this.value);
            this.resolver = undefined;
        }
    }
    public async execute(): Promise<T> {
        // if has been resolved, return
        if (this.value !== undefined) {
            return this.value;
        }
        // if being resolved.
        if (!this.dbContext.deferredQueries.contains(this)) {
            return new Promise<T>((resolve) => {
                this.resolver = resolve;
            });
        }

        await this.dbContext.executeDeferred();
        return this.value;
    }
    public buildQuery(queryBuilder: QueryBuilder) {
        const timer = Diagnostic.timer();

        // convert all array value parameter to temp table
        const arrayParameters = this.parameters.where(o => !!o.parameter.select);
        const arrayParameterTempTableQueries = arrayParameters.selectMany(o => {
            const selectExp = o.parameter.select;
            let i = 0;
            const arrayValues = o.value as any[];
            const columns = selectExp.entity.columns;
            let insertQuery = new InsertExpression(selectExp.entity, [], columns);
            for (const item of arrayValues) {
                const itemExp: { [key: string]: IExpression } = {};
                for (const col of columns) {
                    switch (col.propertyName) {
                        case "__index": {
                            itemExp[col.propertyName] = new ValueExpression(i++);
                            break;
                        }
                        case "__value": {
                            itemExp[col.propertyName] = new ValueExpression(item);
                            break;
                        }
                        default: {
                            const propVal = item[col.propertyName];
                            itemExp[col.propertyName] = new ValueExpression(isNotNull(propVal) ? propVal : null);
                            break;
                        }
                    }
                }
            }
            return queryBuilder.createTable(selectExp.entity).concat(queryBuilder.getInsertQuery(insertQuery));
        });
        const dropArrayTempTableQueries = arrayParameters.select(o => {
            return {
                query: `DROP TABLE ${o.parameter.select.entity.name}`,
                type: QueryType.DDL
            } as IQuery;
        });

        this._queryies = arrayParameterTempTableQueries.union(this.command.toQueryCommands(queryBuilder, this.parameters.where(o => !o.parameter.select).toArray()), true).union(dropArrayTempTableQueries, true).toArray();
        if (Diagnostic.enabled) {
            Diagnostic.debug(this, `Build Query.`, this._queryies);
            Diagnostic.trace(this, `Build Query time: ${timer.time()}ms`);
        }
        return this._queryies;
    }
    public toString() {
        return this.buildQuery(this.dbContext.queryBuilder).select(o => o.query).toArray().join(";\n\n");
    }
    public hashCode() {
        return this.command.hashCode() + this.parameters.select(o => hashCode((o.value || "NULL").toString())).sum();
    }
}