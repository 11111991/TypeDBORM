import { Enumerable } from "../Enumerable/Enumerable";
import { QueryBuilder } from "../QueryBuilder/QueryBuilder";
import { Queryable } from "./Queryable";
import { SelectExpression } from "./QueryExpression/SelectExpression";
import { IObjectType } from "../Common/Type";
import { IQueryVisitParameter } from "../QueryBuilder/QueryExpressionVisitor";
import { hashCode } from "../Helper/Util";
import { ExpressionBuilder } from "../ExpressionBuilder/ExpressionBuilder";
import { FunctionExpression } from "../ExpressionBuilder/Expression/FunctionExpression";
import { ParameterExpression } from "../ExpressionBuilder/Expression/ParameterExpression";
import { IExpression } from "../ExpressionBuilder/Expression/IExpression";
import { ObjectValueExpression } from "../ExpressionBuilder/Expression/ObjectValueExpression";
import { MethodCallExpression } from "../ExpressionBuilder/Expression/MethodCallExpression";

function toObjectValueExpression<T, K, KE extends { [key in keyof K]: FunctionExpression<T, any> | ((item: T) => any) }>(objectFn: KE, sourceType: IObjectType<T>, paramName: string): FunctionExpression<T, { [key in keyof KE]?: IExpression }> {
    const param = new ParameterExpression(paramName, sourceType);
    const objectValue: { [key in keyof KE]?: IExpression } = {};
    for (const prop in objectFn) {
        const value = objectFn[prop];
        let fnExpression: FunctionExpression<T, any>;
        if (value instanceof FunctionExpression)
            fnExpression = value;
        else
            fnExpression = ExpressionBuilder.parse(value as (item: T) => any, [sourceType]);
        objectValue[prop] = fnExpression.body;
    }
    const objExpression = new ObjectValueExpression(objectValue);
    return new FunctionExpression(objExpression, [param]);
}
export class PivotQueryable<T,
    TD extends FunctionExpression<T, any>,
    TM extends FunctionExpression<T[] | Enumerable<T>, any>,
    TResult extends { [key in (keyof TD1 & keyof TM1)]: any },
    TD1 extends { [key: string]: (o: T) => any } = any,
    TM1 extends { [key: string]: (o: T[] | Enumerable<T>) => any } = any> extends Queryable<TResult> {
    protected readonly dimensionFn: TD1;
    protected readonly metricFn: TM1;
    private _dimensions: TD;
    protected get dimensions() {
        if (!this._dimensions && this.dimensionFn)
            this._dimensions = toObjectValueExpression(this.dimensionFn, this.parent.type as IObjectType<T>, "d") as any;
        return this._dimensions;
    }
    protected set dimensions(value) {
        this._dimensions = value;
    }
    private _metrics: TM;
    protected get metrics() {
        if (!this._metrics && this.metricFn)
            this._metrics = toObjectValueExpression(this.metricFn, this.parent.type as IObjectType<T>, "m") as any;
        return this._metrics;
    }
    protected set metrics(value) {
        this._metrics = value;
    }
    constructor(public readonly parent: Queryable<T>, dimensions: TD1 | TD, metrics: TM1 | TM) {
        super(Object, parent);
        if (dimensions instanceof FunctionExpression)
            this.dimensions = dimensions;
        else
            this.dimensionFn = dimensions;
        if (metrics instanceof FunctionExpression)
            this.metrics = metrics;
        else
            this.metricFn = metrics;
    }
    public buildQuery(queryBuilder: QueryBuilder): SelectExpression<TResult> {
        if (!this.expression) {
            const objectOperand = this.parent.buildQuery(queryBuilder).clone();
            const methodExpression = new MethodCallExpression(objectOperand, "pivot", [this.dimensions, this.metrics]);
            const visitParam: IQueryVisitParameter = { commandExpression: objectOperand as SelectExpression, scope: "queryable" };
            this.expression = queryBuilder.visit(methodExpression, visitParam) as SelectExpression;
        }
        return this.expression as any;
    }
    public hashCode() {
        let code = hashCode(this.dimensionFn ? JSON.stringify(this.dimensionFn) : this.dimensions.toString());
        code += hashCode(this.metricFn ? JSON.stringify(this.metricFn) : this.metrics.toString());
        return this.parent.hashCode() + hashCode("PIVOT") + code;
    }
}
