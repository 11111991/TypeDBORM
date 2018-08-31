import { IObjectType, JoinType, ValueType } from "../Common/Type";
import { Queryable } from "./Queryable";
import { IVisitParameter, QueryVisitor } from "../QueryBuilder/QueryVisitor";
import { ExpressionBuilder } from "../ExpressionBuilder/ExpressionBuilder";
import { FunctionExpression } from "../ExpressionBuilder/Expression/FunctionExpression";
import { MethodCallExpression } from "../ExpressionBuilder/Expression/MethodCallExpression";
import { IQueryCommandExpression } from "./QueryExpression/IQueryCommandExpression";
import { SelectExpression } from "./QueryExpression/SelectExpression";

export abstract class JoinQueryable<T = any, T2 = any, K extends ValueType = any, R = any> extends Queryable<R> {
    protected readonly keySelector1Fn: (item: T) => K;
    protected readonly keySelector2Fn: (item: T2) => K;
    protected readonly resultSelectorFn: (item1: T | null, item2: T2 | null) => R;
    private _keySelector1: FunctionExpression<T, K>;
    protected get keySelector1() {
        if (!this._keySelector1 && this.keySelector1Fn)
            this._keySelector1 = ExpressionBuilder.parse(this.keySelector1Fn, this.flatParameterStacks);
        return this._keySelector1;
    }
    protected set keySelector1(value) {
        this._keySelector1 = value;
    }
    private _keySelector2: FunctionExpression<T2, K>;
    protected get keySelector2() {
        if (!this._keySelector2 && this.keySelector1Fn)
            this._keySelector2 = ExpressionBuilder.parse(this.keySelector2Fn, this.flatParameterStacks);
        return this._keySelector2;
    }
    protected set keySelector2(value) {
        this._keySelector2 = value;
    }
    private _resultSelector: FunctionExpression<T | T2, R>;
    protected get resultSelector() {
        if (!this._resultSelector && this.resultSelectorFn)
            this._resultSelector = ExpressionBuilder.parse<T | T2, any>(this.resultSelectorFn, this.flatParameterStacks);
        return this._resultSelector;
    }
    protected set resultSelector(value) {
        this._resultSelector = value;
    }
    constructor(protected joinType: JoinType, public readonly parent: Queryable<T>, protected readonly parent2: Queryable<T2>, keySelector1: FunctionExpression<T, K> | ((item: T) => K), keySelector2: FunctionExpression<T2, K> | ((item: T2) => K), resultSelector?: FunctionExpression<any, R> | ((item1: T | null, item2: T2 | null) => R), public type: IObjectType<R> = Object as any) {
        super(type, parent);
        this.option(this.parent2.option);
        if (keySelector1 instanceof FunctionExpression)
            this.keySelector1 = keySelector1;
        else
            this.keySelector1Fn = keySelector1;

        if (keySelector2 instanceof FunctionExpression)
            this.keySelector2 = keySelector2;
        else
            this.keySelector2Fn = keySelector2;

        if (resultSelector) {
            if (resultSelector instanceof FunctionExpression)
                this.resultSelector = resultSelector;
            else
                this.resultSelectorFn = resultSelector;
        }
    }
    public buildQuery(queryVisitor: QueryVisitor): IQueryCommandExpression<R> {
        const objectOperand = this.parent.buildQuery(queryVisitor) as SelectExpression<T>;
        const childOperand = this.parent2.buildQuery(queryVisitor) as SelectExpression<T2>;
        const type = this.joinType.toLowerCase() + "Join";
        const methodExpression = new MethodCallExpression(objectOperand, type, [childOperand, this.keySelector1, this.keySelector2, this.resultSelector]);
        const visitParam: IVisitParameter = { selectExpression: objectOperand, scope: "queryable" };
        return queryVisitor.visit(methodExpression, visitParam) as any;
    }
}
