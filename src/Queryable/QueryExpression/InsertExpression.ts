import { QueryBuilder } from "../../QueryBuilder/QueryBuilder";
import { ICommandQueryExpression } from "./ICommandQueryExpression";
import { IQueryCommand } from "../../QueryBuilder/Interface/IQueryCommand";
import { ISqlParameter } from "../../QueryBuilder/ISqlParameter";
import { ValueExpressionTransformer } from "../../ExpressionBuilder/ValueExpressionTransformer";
import { SqlParameterExpression } from "../../ExpressionBuilder/Expression/SqlParameterExpression";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { EntityExpression } from "./EntityExpression";
import { IColumnExpression } from "./IColumnExpression";
export class InsertExpression<T = any> implements ICommandQueryExpression<void> {
    public parameters: SqlParameterExpression[];
    private _columns: IColumnExpression<T>[];
    public get columns(): IColumnExpression<T>[] {
        if (!this._columns) {
            this._columns = this.entity.metaData.relations
                .where(o => !o.nullable && !o.isMaster && o.relationType === "one")
                .selectMany(o => o.relationColumns)
                .union(this.entity.metaData.columns)
                .except(this.entity.metaData.insertGeneratedColumns)
                .select(o => this.entity.columns.first(c => c.propertyName === o.propertyName)).toArray();
        }

        return this._columns;
    }
    public get type() {
        return undefined as any;
    }
    constructor(public readonly entity: EntityExpression<T>, public readonly values: Array<Array<IExpression<any> | undefined>>) {
    }
    public clone(): InsertExpression<T> {
        const clone = new InsertExpression(this.entity.clone(), this.values);
        return clone;
    }
    public toQueryCommands(queryBuilder: QueryBuilder, parameters?: ISqlParameter[]): IQueryCommand[] {
        queryBuilder.setParameters(parameters ? parameters : []);
        return queryBuilder.getInsertQuery(this);
    }
    public execute() {
        return this as any;
    }
    public toString(queryBuilder: QueryBuilder): string {
        return this.toQueryCommands(queryBuilder).select(o => o.query).toArray().join(";" + queryBuilder.newLine() + queryBuilder.newLine());
    }
    public buildParameter(params: { [key: string]: any }): ISqlParameter[] {
        const result: ISqlParameter[] = [];
        const valueTransformer = new ValueExpressionTransformer(params);
        for (const sqlParameter of this.parameters) {
            const value = sqlParameter.valueGetter.execute(valueTransformer);
            result.push({
                name: sqlParameter.name,
                parameter: sqlParameter,
                value: value
            });
        }
        return result;
    }
}