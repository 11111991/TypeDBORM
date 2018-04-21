import "../Extensions/StringExtension";
import { JoinType, OrderDirection, RelationType } from "../Common/Type";
import { entityMetaKey, relationMetaKey, columnMetaKey } from "../Decorator/DecoratorKey";
import {
    AdditionExpression, AndExpression, ArrayValueExpression, BitwiseAndExpression,
    BitwiseNotExpression, BitwiseOrExpression, BitwiseSignedRightShiftExpression,
    BitwiseXorExpression, BitwiseZeroLeftShiftExpression, BitwiseZeroRightShiftExpression,
    DivisionExpression, EqualExpression, FunctionCallExpression,
    FunctionExpression, GreaterEqualExpression, GreaterThanExpression, IBinaryOperatorExpression,
    IExpression, InstanceofExpression, IUnaryOperatorExpression,
    LeftDecrementExpression, LeftIncrementExpression, LessEqualExpression, LessThanExpression,
    MemberAccessExpression, MethodCallExpression, NotEqualExpression, NegationExpression, ObjectValueExpression,
    OrExpression, ParameterExpression, RightDecrementExpression,
    RightIncrementExpression, StrictEqualExpression, StrictNotEqualExpression, SubtractionExpression,
    TernaryExpression, MultiplicationExpression, TypeofExpression, ValueExpression
} from "../ExpressionBuilder/Expression";
import { ModulusExpression } from "../ExpressionBuilder/Expression/ModulusExpression";
import { TransformerParameter } from "../ExpressionBuilder/TransformerParameter";
import { isValueType, isNativeFunction, hashCode } from "../Helper/Util";
import { IEntityMetaData, IRelationMetaData } from "../MetaData/Interface/index";
import { NamingStrategy } from "./NamingStrategy";
import { EntityExpression } from "../Queryable/QueryExpression/EntityExpression";
import { GroupByExpression } from "../Queryable/QueryExpression/GroupByExpression";
import { IColumnExpression } from "../Queryable/QueryExpression/IColumnExpression";
import {
    ColumnExpression, ComputedColumnExpression, ExceptExpression,
    IEntityExpression, IntersectExpression, ProjectionEntityExpression, UnionExpression, IOrderExpression, IIncludeRelation
} from "../Queryable/QueryExpression/index";
import { SelectExpression, IJoinRelation } from "../Queryable/QueryExpression/SelectExpression";
import { GroupedExpression } from "../Queryable/QueryExpression/GroupedExpression";
import { ExpressionBuilder } from "../ExpressionBuilder/ExpressionBuilder";
import { ISqlParameterBuilderItem } from "./ParameterBuilder/ISqlParameterBuilderItem";
import { InstantiationExpression } from "../ExpressionBuilder/Expression/InstantiationExpression";
import { ComputedColumnMetaData } from "../MetaData";

interface IPRelation {
    name: string;
    relationMaps: Map<any, any>;
    child: SelectExpression<any>;
    type: RelationType;
}
export interface IQueryVisitParameter {
    commandExpression: SelectExpression;
    scope?: string;
}
export class QueryExpressionVisitor {
    public sqlParameterBuilderItems: ISqlParameterBuilderItem[] = [];
    public userParameters: { [key: string]: any } = {};
    public scopeParameters = new TransformerParameter();
    private aliasObj: { [key: string]: number } = {};
    constructor(public namingStrategy: NamingStrategy = new NamingStrategy()) {
    }
    public newAlias(type: "entity" | "column" = "entity") {
        if (!this.aliasObj[type])
            this.aliasObj[type] = 0;
        return this.namingStrategy.getAlias(type) + this.aliasObj[type]++;
    }
    public visit(expression: IExpression, param: IQueryVisitParameter): IExpression {
        if (expression !== param.commandExpression)
            expression = expression.clone();
        switch (expression.constructor) {
            case MemberAccessExpression:
                return this.visitMember(expression as any, param);
            case MethodCallExpression:
                return this.visitMethod(expression as any, param);
            case FunctionCallExpression:
                return this.visitFunctionCall(expression as any, param);
            case InstantiationExpression:
                return this.visitInstantiation(expression as any, param);
            case BitwiseNotExpression:
            case LeftDecrementExpression:
            case LeftIncrementExpression:
            case NegationExpression:
            case RightDecrementExpression:
            case RightIncrementExpression:
            case TypeofExpression:
                return this.visitUnaryOperator(expression as any as IUnaryOperatorExpression, param);
            case AdditionExpression:
            case AndExpression:
            case BitwiseAndExpression:
            case BitwiseOrExpression:
            case BitwiseSignedRightShiftExpression:
            case BitwiseXorExpression:
            case BitwiseZeroLeftShiftExpression:
            case BitwiseZeroRightShiftExpression:
            case DivisionExpression:
            case EqualExpression:
            case GreaterEqualExpression:
            case GreaterThanExpression:
            case InstanceofExpression:
            case LessEqualExpression:
            case LessThanExpression:
            case ModulusExpression:
            case NotEqualExpression:
            case OrExpression:
            case StrictEqualExpression:
            case StrictNotEqualExpression:
            case SubtractionExpression:
            case MultiplicationExpression:
                return this.visitBinaryOperator(expression as any as IBinaryOperatorExpression, param);
            case TernaryExpression:
                return this.visitTernaryOperator(expression as TernaryExpression<any>, param);
            case ObjectValueExpression:
                return this.visitObjectLiteral(expression as ObjectValueExpression<any>, param);
            case ArrayValueExpression:
                throw new Error(`literal Array not supported`);
            case FunctionExpression:
                return this.visitFunction(expression as FunctionExpression, param);
            case ParameterExpression:
                return this.visitParameter(expression as any, param);
        }
        return expression;
    }
    protected visitParameter<T>(expression: ParameterExpression<T>, param: IQueryVisitParameter) {
        let result = this.scopeParameters.get(expression.name);
        if (!result) {
            result = new ParameterExpression("param_" + Math.abs(hashCode(expression.toString())));
            this.sqlParameterBuilderItems.push({
                name: result.name,
                valueGetter: expression
            });
            return result;
        }
        return result;
    }
    protected visitFunction<T, TR>(expression: FunctionExpression<T, TR>, param: IQueryVisitParameter) {
        return this.visit(expression.body, param);
    }
    protected visitMember<TType, KProp extends keyof TType>(expression: MemberAccessExpression<TType, KProp>, param: IQueryVisitParameter): IExpression {
        const objectOperand = expression.objectOperand = this.visit(expression.objectOperand, param);
        if (expression.memberName === "prototype" || expression.memberName === "__proto__")
            throw new Error(`property ${expression.memberName} not supported in linq to sql.`);

        if (objectOperand instanceof EntityExpression || objectOperand instanceof ProjectionEntityExpression) {
            const parentEntity = objectOperand as IEntityExpression;
            let column = parentEntity.columns.first((c) => c.propertyName === expression.memberName);
            if (!column && objectOperand instanceof EntityExpression) {
                const computedColumnMeta = Reflect.getOwnMetadata(columnMetaKey, objectOperand.type, expression.memberName as string);
                if (computedColumnMeta instanceof ComputedColumnMetaData) {
                    let paramName: string;
                    if (computedColumnMeta.functionExpression.params.length > 0)
                        paramName = computedColumnMeta.functionExpression.params[0].name;
                    if (paramName)
                        this.scopeParameters.add(paramName, objectOperand);
                    const result = this.visit(computedColumnMeta.functionExpression.clone(), { commandExpression: param.commandExpression });
                    if (paramName)
                        this.scopeParameters.remove(paramName);
                    if (result instanceof EntityExpression || result instanceof SelectExpression)
                        throw new Error(`${objectOperand.type.name}.${expression.memberName} not supported`);

                    column = new ComputedColumnExpression(parentEntity, result, expression.memberName as any);
                }
            }
            if (column) {
                switch (param.scope) {
                    case "include":
                        if (parentEntity.select) {
                            if (!(column instanceof ComputedColumnExpression)) {
                                parentEntity.select.clearDefaultColumns();
                            }
                        }
                        break;
                }
                if (parentEntity.select) {
                    parentEntity.select.selects.add(column);
                }
                return column;
            }
            const relationMeta: IRelationMetaData<any, any> = Reflect.getOwnMetadata(relationMetaKey, objectOperand.type, expression.memberName as string);
            if (relationMeta) {
                const targetType = relationMeta.targetType;
                switch (param.scope) {
                    case "select":
                    case "selectMany":
                        {
                            let child = new SelectExpression(new EntityExpression(targetType, this.newAlias()));
                            if (relationMeta.relationType === RelationType.OneToMany && param.scope === "select") {
                                param.commandExpression.objectType = Array;
                                param.commandExpression.selects = [];

                                param.commandExpression.addInclude(relationMeta.foreignKeyName, child, relationMeta);
                                return param.commandExpression;
                            }
                            else {
                                if (param.commandExpression.where || param.commandExpression.orders.length > 0) {
                                    child.addJoinRelation(param.commandExpression, relationMeta);
                                    child.addOrder(param.commandExpression.orders);
                                }
                                param.commandExpression = child;
                                return relationMeta.relationType === RelationType.OneToMany ? child : child.entity;
                            }
                        }
                    case "include":
                        {
                            let child = new SelectExpression(new EntityExpression(targetType, this.newAlias()));
                            parentEntity.select!.addInclude(expression.memberName as any, child, relationMeta);
                            return relationMeta.relationType === RelationType.OneToMany ? child : child.entity;
                        }
                    default:
                        {
                            let child = new SelectExpression(new EntityExpression(targetType, this.newAlias()));
                            let joinType: JoinType;
                            if (param.scope === "orderBy")
                                joinType = JoinType.LEFT;
                            parentEntity.select!.addJoinRelation(child, relationMeta, joinType);
                            return relationMeta.relationType === RelationType.OneToMany ? child : child.entity;
                        }
                }
            }
        }
        else if (objectOperand instanceof SelectExpression && expression.memberName === "length") {
            return this.visit(new MethodCallExpression(objectOperand, "count", []), param);
        }
        else if (objectOperand instanceof GroupedExpression) {
            if (expression.memberName === "key") {
                return objectOperand.key;
            }
        }
        else if (objectOperand instanceof ParameterExpression) {
            const existing = this.sqlParameterBuilderItems.find(o => o.name === objectOperand.name);
            this.sqlParameterBuilderItems.remove(existing);
            expression.objectOperand = existing.valueGetter;
            const result = new ParameterExpression("param_" + Math.abs(hashCode(expression.toString())));
            this.sqlParameterBuilderItems.push({ name: result.name, valueGetter: expression });
            return result;
        }
        else if (objectOperand instanceof ValueExpression) {
            return new ValueExpression(expression.execute());
        }
        else {
            switch (objectOperand.type) {
                case String:
                    switch (expression.memberName) {
                        case "length":
                            return expression;
                    }
                    break;
            }
        }

        throw new Error(`${objectOperand.type.name}.${expression.memberName} is invalid or not supported in linq to sql.`);
    }
    protected visitInstantiation<TType>(expression: InstantiationExpression<TType>, param: IQueryVisitParameter): IExpression {
        switch (expression.type as any) {
            case Date:
                {
                    const paramExps: ParameterExpression[] = [];
                    if (expression.params.all(o => {
                        if (o instanceof ParameterExpression) {
                            const scopeParam = this.scopeParameters.get(o.name);
                            paramExps.push(o);
                            return typeof scopeParam === "undefined";
                        }
                        return o instanceof ValueExpression;
                    })) {
                        paramExps.forEach(o => {
                            const existing = this.sqlParameterBuilderItems.find(p => p.name === o.name);
                            if (existing)
                                this.sqlParameterBuilderItems.remove(existing);
                        });

                        const result = new ParameterExpression("param_" + Math.abs(hashCode(expression.toString())));
                        this.sqlParameterBuilderItems.push({ name: result.name, valueGetter: expression });
                        return result;
                    }
                }
                break;
        }
        throw new Error(`${expression.type.name} not supported.`);
    }
    protected visitMethod<TType, KProp extends keyof TType, TResult = any>(expression: MethodCallExpression<TType, KProp, TResult>, param: IQueryVisitParameter): IExpression {
        const objectOperand = expression.objectOperand = this.visit(expression.objectOperand, param);

        if (objectOperand instanceof SelectExpression) {
            let selectOperand = objectOperand as SelectExpression;
            switch (expression.methodName) {
                case "select":
                case "selectMany":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        const parentRelation = objectOperand.parentRelation;
                        const selectorFn = expression.params[0] as FunctionExpression<TType, TResult>;
                        const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: param.scope === "select" || param.scope === "selectMany" ? expression.methodName : "" };
                        this.scopeParameters.add(selectorFn.params[0].name, selectOperand.getVisitParam());
                        const selectExp = this.visit(selectorFn, visitParam);
                        this.scopeParameters.remove(selectorFn.params[0].name);
                        param.commandExpression = visitParam.commandExpression;

                        if (expression.methodName === "select") {
                            if (selectExp instanceof SelectExpression) {
                                selectOperand = selectExp;
                            }
                            else if ((selectExp as EntityExpression).primaryColumns) {
                                selectOperand = visitParam.commandExpression;
                            }
                            else if (selectExp instanceof ObjectValueExpression) {
                                const newSelects: IColumnExpression[] = [];
                                const joinRelations: Array<IPRelation> = [];
                                for (const prop in selectExp.object) {
                                    const valueExp = selectExp.object[prop];
                                    if (valueExp instanceof ColumnExpression) {
                                        const colClone = valueExp.clone();
                                        colClone.propertyName = prop;
                                        newSelects.add(colClone);
                                    }
                                    else if (valueExp instanceof ComputedColumnExpression) {
                                        const colClone = new ColumnExpression(valueExp.entity, prop, valueExp.type, valueExp.isPrimary, valueExp.columnName);
                                        newSelects.add(colClone);
                                    }
                                    else if ((valueExp as IEntityExpression).primaryColumns) {
                                        // o.Order.Outlet.Store
                                        let childEntity = valueExp as IEntityExpression;

                                        if (childEntity.select === selectOperand) {
                                            const cloneSelect = childEntity.select.clone();
                                            cloneSelect.joins = [];
                                            childEntity = cloneSelect.entity;
                                            const relationMap = new Map<any, any>();
                                            for (let i = 0; i < selectOperand.entity.primaryColumns.length; i++) {
                                                const pCol = selectOperand.entity.primaryColumns[i];
                                                const cCol = childEntity.primaryColumns[i];
                                                relationMap.set(pCol, cCol);
                                            }
                                            const pr: IPRelation = {
                                                name: prop,
                                                child: cloneSelect,
                                                relationMaps: relationMap,
                                                type: RelationType.OneToOne
                                            };
                                            joinRelations.push(pr);
                                        }
                                        else {
                                            let parentRel = childEntity.select.parentRelation as IJoinRelation<any, any>;
                                            while ((parentRel as any).name === undefined && parentRel.parent !== selectOperand) {
                                                const relationMap = new Map<any, any>();
                                                for (const [sourceCol, targetCol] of parentRel.relations) {
                                                    relationMap.set(targetCol, sourceCol);
                                                }
                                                const nextRel = parentRel.parent.parentRelation as IJoinRelation<any, any>;
                                                parentRel.parent.joins.remove(parentRel);
                                                parentRel.child.addJoinRelation(parentRel.parent, relationMap, JoinType.INNER);
                                                if (!parentRel) break;
                                                parentRel = nextRel;
                                            }
                                            selectOperand.joins.remove(parentRel);
                                            const pr: IPRelation = {
                                                name: prop,
                                                child: valueExp.select,
                                                relationMaps: parentRel.relations,
                                                type: RelationType.OneToOne
                                            };
                                            joinRelations.push(pr);
                                        }
                                    }
                                    else if (valueExp instanceof SelectExpression) {
                                        // o.Order.Outlet.Registers => Register.Outlet.Order
                                        let parentRel = valueExp.parentRelation as IJoinRelation<any, any>;
                                        while ((parentRel as any).name === undefined && parentRel.parent !== selectOperand) {
                                            const relationMap = new Map<any, any>();
                                            for (const [sourceCol, targetCol] of parentRel.relations) {
                                                relationMap.set(targetCol, sourceCol);
                                            }
                                            const nextRel = parentRel.parent.parentRelation as IJoinRelation<any, any>;
                                            parentRel.parent.joins.remove(parentRel);
                                            parentRel.child.addJoinRelation(parentRel.parent, relationMap, JoinType.INNER);
                                            if (!parentRel) break;
                                            parentRel = nextRel;
                                        }

                                        selectOperand.joins.remove(parentRel);
                                        const pr: IPRelation = {
                                            name: prop,
                                            child: valueExp,
                                            relationMaps: parentRel.relations,
                                            type: RelationType.OneToMany
                                        };
                                        joinRelations.push(pr);
                                    }
                                    else {
                                        newSelects.add(new ComputedColumnExpression(valueExp.entity, valueExp, prop));
                                    }
                                }

                                selectOperand.objectType = Object;
                                selectOperand.selects = newSelects;
                                // selectOperand = new SelectExpression(new ProjectionEntityExpression(selectOperand, Object));
                                for (const rel of joinRelations)
                                    selectOperand.addInclude(rel.name, rel.child, rel.relationMaps, rel.type);
                            }
                            else if ((selectExp as IColumnExpression).entity) {
                                const column = selectExp as IColumnExpression;
                                // const objectSelectOperand = new SelectExpression(new ProjectionEntityExpression(selectOperand, column.type));
                                // selectOperand = objectSelectOperand;
                                selectOperand.objectType = column.type;
                                selectOperand.selects = [column];
                            }
                            else {
                                const column = new ComputedColumnExpression(selectOperand.entity, selectExp, this.newAlias("column"));
                                // const objectSelectOperand = new SelectExpression(new ProjectionEntityExpression(selectOperand, column.type));
                                // selectOperand = objectSelectOperand;
                                selectOperand.objectType = column.type;
                                selectOperand.selects = [column];
                            }
                        }
                        else {
                            if (!(selectExp instanceof SelectExpression)) {
                                throw new Error(`Queryable<${objectOperand.type}>.selectMany required selector with array or queryable or enumerable return value.`);
                            }
                            selectOperand = selectExp;
                        }

                        if (parentRelation) {
                            parentRelation.child = selectOperand;
                            selectOperand.parentRelation = parentRelation;
                        }
                        else {
                            param.commandExpression = selectOperand;
                        }

                        return selectOperand;
                    }
                case "where":
                    {
                        const predicateFn = expression.params[0] as FunctionExpression<TType, boolean>;
                        const visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: "where" };
                        this.scopeParameters.add(predicateFn.params[0].name, objectOperand.getVisitParam());
                        const whereExp = this.visit(predicateFn, visitParam) as IExpression<boolean>;
                        this.scopeParameters.remove(predicateFn.params[0].name);

                        if (whereExp.type !== Boolean) {
                            throw new Error(`Queryable<${objectOperand.type}>.where required predicate with boolean return value.`);
                        }
                        objectOperand.addWhere(whereExp);
                        return objectOperand;
                    }
                case "orderBy":
                    {
                        const selectors = expression.params as ObjectValueExpression<any>[];
                        const orders: IOrderExpression[] = [];
                        for (const selector of selectors) {
                            const selectorFn = selector.object.selector as FunctionExpression<TType, any>;
                            const direction = selector.object.direction ? selector.object.direction as ValueExpression<OrderDirection> : new ValueExpression(OrderDirection.ASC);
                            const visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: expression.methodName };
                            this.scopeParameters.add(selectorFn.params[0].name, objectOperand.getVisitParam());
                            const selectExp = this.visit(selectorFn, visitParam) as IColumnExpression;
                            this.scopeParameters.remove(selectorFn.params[0].name);

                            if (!isValueType(selectExp.type)) {
                                throw new Error(`Queryable<${objectOperand.type}>.orderBy required select with basic type return value.`);
                            }
                            orders.push({
                                column: selectExp,
                                direction: direction.value
                            });
                        }
                        if (orders.length > 0) {
                            objectOperand.orders = [];
                            objectOperand.addOrder(orders);
                        }
                        return objectOperand;
                    }
                case "groupBy":
                    {
                        // TODO: queryable end with group by. Orders.groupBy(o => o.OrderDate).toArray();
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        const parentRelation = objectOperand.parentRelation;
                        const selectorFn = expression.params[0] as FunctionExpression<TType, any>;
                        const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                        this.scopeParameters.add(selectorFn.params[0].name, selectOperand.getVisitParam());
                        const selectExp = this.visit(selectorFn, visitParam);
                        this.scopeParameters.remove(selectorFn.params[0].name);
                        param.commandExpression = visitParam.commandExpression;

                        if (selectExp instanceof SelectExpression) {
                            throw new Error(`Queryable<${objectOperand.type}>.groupBy did not support selector with array or queryable or enumerable return value.`);
                        }
                        // selectOperand = visitParam.commandExpression;
                        let groupColumns: IColumnExpression[] = [];
                        if (selectExp instanceof ObjectValueExpression) {
                            for (const prop in selectExp.object) {
                                const valueExp = selectExp.object[prop];
                                if (valueExp instanceof ColumnExpression) {
                                    groupColumns.push(new ColumnExpression(valueExp.entity, prop, valueExp.type, valueExp.isPrimary, valueExp.columnName));
                                }
                                else if (valueExp instanceof ComputedColumnExpression) {
                                    groupColumns.push(new ComputedColumnExpression(valueExp.entity, valueExp.expression, prop));
                                }
                                else if ((valueExp as IEntityExpression).primaryColumns) {
                                    const childEntity = valueExp as IEntityExpression;
                                    if (childEntity.select)
                                        groupColumns = groupColumns.concat(childEntity.select.selects);
                                    else
                                        groupColumns = groupColumns.concat(childEntity.columns);
                                        }
                                else if (valueExp instanceof SelectExpression) {
                                    throw new Error(`Queryable<${objectOperand.type}>.groupBy did not support selector with array or queryable or enumerable return value.`);
                                }
                                }
                            }
                        else if ((selectExp as IColumnExpression).entity) {
                            const column = selectExp as IColumnExpression;
                            groupColumns = [column];
                        }
                        else {
                            const column = new ComputedColumnExpression(selectOperand.entity, selectExp, this.newAlias("column"));
                            groupColumns = [column];
                        }

                        selectOperand = new GroupByExpression(selectOperand, groupColumns, selectExp);
                        if (parentRelation) {
                            parentRelation.child = selectOperand;
                            selectOperand.parentRelation = parentRelation;
                        }
                        else {
                            param.commandExpression = selectOperand;
                        }
                        return selectOperand;
                    }
                case "skip":
                case "take":
                    {
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);
                    }
                case "distinct":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        objectOperand.distinct = true;
                        objectOperand.isAggregate = param.scope === expression.methodName;
                        return objectOperand;
                    }
                case "include":
                    {
                        for (const paramFn of expression.params) {
                            const selectorFn = paramFn as FunctionExpression<TType, TResult>;
                            this.scopeParameters.add(selectorFn.params[0].name, objectOperand.getVisitParam());
                            let visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: "include" };
                            this.visit(selectorFn, visitParam);
                            this.scopeParameters.remove(selectorFn.params[0].name);
                        }
                        return objectOperand;
                    }
                case "toArray":
                    {
                        return objectOperand;
                    }
                case "count":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        const column = new ComputedColumnExpression(objectOperand.entity, new MethodCallExpression(objectOperand, expression.methodName, [], Number), this.newAlias("column"));
                        if (param.scope === expression.methodName) {
                            // call from queryable
                            objectOperand.selects = [column];
                            objectOperand.objectType = Number;
                            objectOperand.isAggregate = true;
                            return objectOperand;
                        }
                        else {
                            // any is used on related entity. change query to groupby.
                            const groupBy = [];
                            const keyObject: any = {};
                            for (const [, entityCol] of selectOperand.parentRelation.relations) {
                                groupBy.push(entityCol);
                                keyObject[entityCol.propertyName] = entityCol;
                            }
                            const groupExp = new GroupByExpression(selectOperand, groupBy, new ObjectValueExpression(keyObject));
                            const flagColumn = column;
                            groupExp.selects.push(flagColumn);
                            groupExp.isAggregate = true;
                            return flagColumn;
                        }
                    }
                case "sum":
                case "avg":
                case "max":
                case "min":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        if (expression.params.length > 0) {
                            const selectorFn = expression.params[0] as FunctionExpression;
                            this.scopeParameters.add(selectorFn.params[0].name, selectOperand.getVisitParam());
                            const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                            const selectExpression: SelectExpression = this.visit(new MethodCallExpression(objectOperand, "select", [selectorFn]), visitParam) as any;
                            this.scopeParameters.remove(selectorFn.params[0].name);
                            param.commandExpression = visitParam.commandExpression;

                            if (!isValueType(selectExpression.objectType))
                                throw new Error(`Queryable<${selectOperand.type.name}> required select with basic type return value.`);

                            selectOperand = selectExpression;
                        }

                        const column = new ComputedColumnExpression(selectOperand.entity, new MethodCallExpression(selectOperand, expression.methodName, selectOperand.selects.select(o => {
                            if (o instanceof ComputedColumnExpression)
                                return o.expression;
                            return o;
                        }).toArray(), Number), this.newAlias("column"));
                        if (param.scope === expression.methodName) {
                            // call from queryable
                            objectOperand.selects = [column];
                            objectOperand.isAggregate = true;
                            return objectOperand;
                        }
                        else {
                            // any is used on related entity. change query to groupby.
                            const groupBy = [];
                            const keyObject: any = {};
                            for (const [, entityCol] of selectOperand.parentRelation.relations) {
                                groupBy.push(entityCol);
                                keyObject[entityCol.propertyName] = entityCol;
                            }
                            const groupExp = new GroupByExpression(selectOperand, groupBy, new ObjectValueExpression(keyObject));
                            const flagColumn = column;
                            groupExp.selects.push(flagColumn);
                            groupExp.isAggregate = true;
                            return flagColumn;
                        }
                    }
                case "all":
                case "any":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        const isAny = expression.methodName === "any";
                        if (expression.params.length > 0) {
                            let predicateFn = expression.params[0] as FunctionExpression;
                            if (!isAny)
                                predicateFn.body = new NegationExpression(predicateFn.body);
                            const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                            this.visit(new MethodCallExpression(selectOperand, "where", [predicateFn]), visitParam);
                        }
                        const column = new ComputedColumnExpression(objectOperand.entity, new ValueExpression(isAny), this.newAlias("column"));
                        if (param.scope === expression.methodName) {
                            // call from queryable
                            objectOperand.selects = [column];
                            objectOperand.paging.take = 1;
                            objectOperand.isAggregate = true;
                            return objectOperand;
                        }
                        else {
                            // any is used on related entity. change query to groupby.
                            const groupBy = [];
                            const keyObject: any = {};
                            for (const [, entityCol] of selectOperand.parentRelation.relations) {
                                groupBy.push(entityCol);
                                keyObject[entityCol.propertyName] = entityCol;
                            }
                            const groupExp = new GroupByExpression(selectOperand, groupBy, new ObjectValueExpression(keyObject));
                            groupExp.selects.push(column);
                            return new (isAny ? NotEqualExpression : EqualExpression)(column, new ValueExpression(null));
                        }
                    }
                case "first":
                    {
                        if (param.scope !== "first")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        if (expression.params.length > 0) {
                            const predicateFn = expression.params[0] as FunctionExpression;
                            const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                            this.visit(new MethodCallExpression(selectOperand, "where" as any, [predicateFn]), visitParam);
                            param.commandExpression = visitParam.commandExpression;
                        }
                        selectOperand.paging.take = 1;
                        return selectOperand.entity;
                    }
                case "innerJoin":
                case "leftJoin":
                case "rightJoin":
                case "fullJoin":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        const parentRelation = objectOperand.parentRelation;
                        const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: "join" };
                        const childSelectOperand: SelectExpression = this.visit(expression.params[0], visitParam) as any;
                        const childVisitParam: IQueryVisitParameter = { commandExpression: childSelectOperand, scope: "join" };

                        const parentKeySelector = expression.params[1] as FunctionExpression;
                        this.scopeParameters.add(parentKeySelector.params[0].name, selectOperand.getVisitParam());
                        let parentKey = this.visit(parentKeySelector, visitParam);
                        this.scopeParameters.remove(parentKeySelector.params[0].name);

                        const childKeySelector = expression.params[2] as FunctionExpression;
                        this.scopeParameters.add(childKeySelector.params[0].name, childSelectOperand.getVisitParam());
                        let childKey = this.visit(childKeySelector, childVisitParam);
                        this.scopeParameters.remove(childKeySelector.params[0].name);

                        let joinRelationMap = new Map<IColumnExpression<any, any>, IColumnExpression<any, any>>();

                        if (parentKey.type !== childKey.type) {
                            throw new Error(`Key type not match`);
                        }
                        else if ((parentKey as IEntityExpression).primaryColumns) {
                            const parentEntity = parentKey as IEntityExpression;
                            const childEntity = childKey as IEntityExpression;
                            for (const parentCol of parentEntity.primaryColumns) {
                                const childCol = childEntity.primaryColumns.first((c) => c.propertyName === parentCol.propertyName);
                                joinRelationMap.set(parentCol, childCol);
                            }
                        }
                        else {
                            if (!(childKey as IColumnExpression).entity)
                                childKey = new ComputedColumnExpression(childSelectOperand.entity, childKey, this.newAlias());
                            if (!(parentKey as IColumnExpression).entity)
                                parentKey = new ComputedColumnExpression(selectOperand.entity, parentKey, this.newAlias());
                            joinRelationMap.set(parentKey as any, childKey as any);
                        }

                        let jointType: JoinType;
                        switch (expression.methodName) {
                            case "leftJoin":
                                jointType = JoinType.LEFT;
                                break;
                            case "rightJoin":
                                jointType = JoinType.RIGHT;
                                break;
                            case "fullJoin":
                                jointType = JoinType.FULL;
                                break;
                            default:
                                jointType = JoinType.INNER;
                                break;
                        }

                        selectOperand.addJoinRelation(childSelectOperand, joinRelationMap, jointType);

                        const resultVisitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: "join" };
                        const resultSelector = expression.params[3] as FunctionExpression;
                        this.scopeParameters.add(resultSelector.params[1].name, childSelectOperand.getVisitParam());
                        this.visit(new MethodCallExpression(selectOperand, "select", [resultSelector]), resultVisitParam);
                        this.scopeParameters.remove(resultSelector.params[1].name);
                        if (parentRelation) {
                            parentRelation.child = selectOperand;
                            selectOperand.parentRelation = parentRelation;
                        }
                        else {
                            param.commandExpression = selectOperand;
                        }

                        return selectOperand;
                    }
                case "union":
                case "intersect":
                case "except":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        const parentRelation = objectOperand.parentRelation;
                        const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                        const childSelectOperand: SelectExpression = this.visit(expression.params[0], visitParam) as any;
                        param.commandExpression = visitParam.commandExpression;

                        let entityExp: IEntityExpression;
                        switch (expression.methodName) {
                            case "union":
                                const isUnionAll = expression.params.length <= 1 ? false : expression.params[1].execute();
                                entityExp = new UnionExpression(selectOperand, childSelectOperand, isUnionAll);
                                break;
                            case "intersect":
                                entityExp = new IntersectExpression(selectOperand, childSelectOperand);
                                break;
                            case "except":
                                entityExp = new ExceptExpression(selectOperand, childSelectOperand);
                                break;
                        }
                        selectOperand = new SelectExpression(entityExp);
                        if (parentRelation) {
                            parentRelation.child = selectOperand;
                            selectOperand.parentRelation = parentRelation;
                        }
                        else {
                            param.commandExpression = selectOperand;
                        }
                        return selectOperand;
                    }
                case "pivot":
                    {
                        if (param.scope === "include")
                            throw new Error(`${param.scope} did not support ${expression.methodName}`);

                        const parentRelation = objectOperand.parentRelation;

                        const dimensions = expression.params[0] as FunctionExpression<TType, any>;
                        const metrics = expression.params[1] as FunctionExpression<TType, any>;

                        // groupby
                        let visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: expression.methodName };
                        const groupExp: GroupByExpression = this.visit(new MethodCallExpression(objectOperand, "groupBy", [dimensions]), visitParam) as any;
                        param.commandExpression = visitParam.commandExpression;

                        const dObject = (dimensions.body as ObjectValueExpression<any>).object;
                        const mObject = (metrics.body as ObjectValueExpression<any>).object;
                        const dmObject: { [key: string]: IExpression } = {};
                        for (const prop in dObject)
                            dmObject[prop] = dObject[prop];
                        for (const prop in mObject)
                            dmObject[prop] = dObject[prop];

                        // select
                        const selectorFn = new FunctionExpression(new ObjectValueExpression(dmObject), metrics.params);
                        this.scopeParameters.add(dimensions.params[0].name, groupExp.key);
                        this.scopeParameters.add(selectorFn.params[0].name, groupExp.getVisitParam());
                        visitParam = { commandExpression: groupExp, scope: expression.methodName };
                        const selectExpression: SelectExpression = this.visit(new MethodCallExpression(groupExp, "select", [selectorFn]), visitParam) as any;
                        this.scopeParameters.remove(selectorFn.params[0].name);
                        this.scopeParameters.remove(dimensions.params[0].name);
                        param.commandExpression = visitParam.commandExpression;
                        selectOperand = selectExpression;

                        if (parentRelation) {
                            parentRelation.child = selectOperand;
                            selectOperand.parentRelation = parentRelation;
                        }
                        else {
                            param.commandExpression = selectOperand;
                        }
                        return selectOperand;
                    }
                default:
                    throw new Error(`${expression.methodName} not supported on expression`);
            }
        }
        else {
            expression.params = expression.params.select(o => this.visit(o, { commandExpression: param.commandExpression })).toArray();

            if (expression.objectOperand instanceof ValueExpression) {
                switch (expression.objectOperand.value) {
                    case Math:
                        switch (expression.methodName) {
                            case "random": {
                                const result = new ParameterExpression("param_" + Math.abs(hashCode(expression.toString())));
                                this.sqlParameterBuilderItems.push({ name: result.name, valueGetter: expression });
                                return result;
                            }
                            case "max":
                            case "min":
                                return expression;
                        }
                        break;
                    case Date:
                        switch (expression.methodName) {
                            case "now": {
                                const result = new ParameterExpression("param_" + Math.abs(hashCode(expression.toString())));
                                this.sqlParameterBuilderItems.push({ name: result.name, valueGetter: expression });
                                return result;
                            }
                            case "toDate":
                            case "toTime":
                            case "addDays":
                            case "addMonths":
                            case "addYears":
                            case "addHours":
                            case "addMinutes":
                            case "addSeconds":
                            case "addMilliSeconds":
                                return expression;
                        }
                        break;
                }
            }
            if (objectOperand instanceof ValueExpression || objectOperand instanceof ParameterExpression) {
                const paramExps: ParameterExpression[] = [];
                if (objectOperand instanceof ParameterExpression) {
                    paramExps.push(objectOperand);
                }
                const isAllValueOrParam = expression.params.all(o => {
                    if (o instanceof ParameterExpression) {
                        const scopeParam = this.scopeParameters.get(o.name);
                        return typeof scopeParam === "undefined";
                    }
                    return o instanceof ValueExpression;
                });
                if (isAllValueOrParam) {
                    let hasParam = false;
                    if (objectOperand instanceof ParameterExpression) {
                        hasParam = true;
                        const existing = this.sqlParameterBuilderItems.find(p => p.name === objectOperand.name);
                        expression.objectOperand = existing.valueGetter as any;
                    }
                    expression.params = expression.params.select(o => {
                        if (o instanceof ParameterExpression) {
                            hasParam = true;
                            const existing = this.sqlParameterBuilderItems.find(p => p.name === o.name);
                            return existing.valueGetter as any;
                        }
                        return o;
                    }).toArray();

                    if (hasParam) {
                        const result = new ParameterExpression("param_" + Math.abs(hashCode(expression.toString())));
                        this.sqlParameterBuilderItems.push({ name: result.name, valueGetter: expression });
                        return result;
                    }
                    else {
                        return new ValueExpression(expression.execute());
                    }
                }
            }
            if (objectOperand.type as any === String) {
                switch (expression.methodName) {
                    case "like":
                        return expression;
                }
            }

            const methodFn: () => any = objectOperand.type.prototype[expression.methodName];
            if (methodFn) {
                if (isNativeFunction(methodFn))
                    return expression;

                // try convert user defined method to a FunctionExpression and built it as a query.
                const methodExp = ExpressionBuilder.parse(methodFn, expression.params.select(o => o.type).toArray());
                for (let i = 0; i < expression.params.length; i++) {
                    this.scopeParameters.add(methodExp.params[i].name, expression.params[i]);
                }
                const result = this.visitFunction(methodExp, { commandExpression: param.commandExpression });
                for (let i = 0; i < expression.params.length; i++) {
                    this.scopeParameters.remove(methodExp.params[i].name);
                }
                return result;
            }
        }
        throw new Error(`${expression.methodName} not supported.`);
    }
    protected visitFunctionCall<T>(expression: FunctionCallExpression<T>, param: IQueryVisitParameter): IExpression {
        expression.params = expression.params.select((o) => this.visit(o, param)).toArray();
        return expression;
    }
    protected visitBinaryOperator(expression: IBinaryOperatorExpression, param: IQueryVisitParameter): IExpression {
        expression.leftOperand = this.visit(expression.leftOperand, param);
        expression.rightOperand = this.visit(expression.rightOperand, param);
        return expression;
    }
    protected visitUnaryOperator(expression: IUnaryOperatorExpression, param: IQueryVisitParameter): IExpression {
        expression.operand = this.visit(expression.operand, param);
        return expression;
    }
    protected visitTernaryOperator(expression: TernaryExpression<any>, param: IQueryVisitParameter): IExpression {
        expression.logicalOperand = this.visit(expression.logicalOperand, param);
        expression.trueResultOperand = this.visit(expression.trueResultOperand, param);
        expression.falseResultOperand = this.visit(expression.falseResultOperand, param);
        return expression;
    }
    protected visitObjectLiteral<T extends { [Key: string]: IExpression } = any>(expression: ObjectValueExpression<T>, param: IQueryVisitParameter) {
        const objectValue: any = {};
        for (const prop in expression.object) {
            objectValue[prop] = this.visit(expression.object[prop], { commandExpression: param.commandExpression });
        }
        expression.object = objectValue;
        return expression;
    }
}