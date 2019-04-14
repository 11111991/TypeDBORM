import { SelectExpression } from "../QueryExpression/SelectExpression";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { RelationshipType } from "../../Common/Type";
import { IColumnExpression } from "../QueryExpression/IColumnExpression";
import { visitExpression, resolveClone } from "../../Helper/Util";
import { EqualExpression } from "../../ExpressionBuilder/Expression/EqualExpression";
import { StrictEqualExpression } from "../../ExpressionBuilder/Expression/StrictEqualExpression";
import { AndExpression } from "../../ExpressionBuilder/Expression/AndExpression";
import { ISelectRelation } from "./ISelectRelation";

export class IncludeRelation<T = any, TChild = any> implements ISelectRelation<T, TChild> {
    constructor();
    constructor(parent: SelectExpression<T>, child: SelectExpression<TChild>, name: string, type: RelationshipType, relations?: IExpression<boolean>);
    constructor(parent?: SelectExpression<T>, child?: SelectExpression<TChild>, name?: string, type?: RelationshipType, relations?: IExpression<boolean>) {
        if (parent) {
            this.parent = parent;
            this.child = child;
            this.relation = relations;
            this.type = type;
            this.name = name;
        }
    }

    private _parentColumns: IColumnExpression[];
    private _childColumns: IColumnExpression[];
    private _isManyManyRelation: boolean;

    private analyzeRelation() {
        this._parentColumns = [];
        this._childColumns = [];
        this._isManyManyRelation = false;
        visitExpression(this.relation, (exp: IExpression) => {
            if ((exp as IColumnExpression).entity) {
                const colExp = exp as IColumnExpression;
                if (this.child.entity === colExp.entity) {
                    this._childColumns.push(colExp);
                }
                else if (this.parent.entity === colExp.entity) {
                    this._parentColumns.push(colExp);
                }
                else if (this.child.allJoinedEntities.contains(colExp.entity)) {
                    this._childColumns.push(colExp);
                }
                else if (this.parent.allJoinedEntities.contains(colExp.entity)) {
                    this._parentColumns.push(colExp);
                }
            }
            else if (!(exp instanceof AndExpression || exp instanceof EqualExpression || exp instanceof StrictEqualExpression)) {
                this._isManyManyRelation = true;
            }
        });

        if (!this._isManyManyRelation) {
            this._isManyManyRelation = this._childColumns.any(o => !this.child.primaryKeys.contains(o)) && this._parentColumns.any(o => !this.parent.primaryKeys.contains(o));
        }
    }
    //#endregion

    //#region Properties
    public parent: SelectExpression<T>;
    public child: SelectExpression<TChild>;
    public relation: IExpression<boolean>;
    public type: RelationshipType;
    public name: string;
    public isEmbedded: boolean;
    public get parentColumns() {
        if (!this._parentColumns) {
            this.analyzeRelation();
        }
        return this._parentColumns;
    }
    public get childColumns() {
        if (!this._childColumns) {
            this.analyzeRelation();
        }
        return this._childColumns;
    }
    public * relationMap() {
        for (let i = 0, len = this.parentColumns.length; i < len; i++) {
            yield [this.parentColumns[i], this.childColumns[i]];
        }
    }
    public get isManyToManyRelation() {
        if (typeof this._isManyManyRelation !== "boolean") {
            this.analyzeRelation();
        }
        return this._isManyManyRelation;
    }
    //#endregion

    //#region Methods
    public addRelation(parentColumn: IColumnExpression, childColumn: IColumnExpression) {
        const logicalExp = new StrictEqualExpression(parentColumn, childColumn);
        this.relation = this.relation ? new AndExpression(this.relation, logicalExp) : logicalExp;
    }
    public clone(replaceMap: Map<IExpression, IExpression>) {
        const child = resolveClone(this.child, replaceMap);
        const parent = resolveClone(this.parent, replaceMap);
        const relation = resolveClone(this.relation, replaceMap);
        const clone = new IncludeRelation(parent, child, this.name, this.type, relation);
        if (child !== this.child) child.parentRelation = clone;
        clone.isEmbedded = this.isEmbedded;
        return clone;
    }
    //#endregion
}