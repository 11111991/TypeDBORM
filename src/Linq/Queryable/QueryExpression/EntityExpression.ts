import { IObjectType } from "../../../Common/Type";
import { entityMetaKey } from "../../../Decorator/DecoratorKey";
import { EntityMetaData } from "../../../MetaData";
import { QueryBuilder } from "../../QueryBuilder";
import { ColumnExpression } from "./ColumnExpression";
import { IColumnExpression } from "./IColumnExpression";
import { IEntityExpression } from "./IEntityExpression";
import { IOrderExpression } from "./IOrderExpression";

export class EntityExpression<T = any> implements IEntityExpression<T> {
    public get name() {
        return this.metaData.name;
    }
    public get metaData() {
        if (!this._metaData)
            this._metaData = Reflect.getOwnMetadata(entityMetaKey, this.type);
        return this._metaData;
    }
    public get columns(): IColumnExpression[] {
        if (!this._columns) {
            this._columns = this.metaData.properties.select((o) => new ColumnExpression(this, o)).toArray();
        }
        return this._columns;
    }
    public get defaultOrders(): IOrderExpression[] {
        if (!this._defaultOrders) {
            if (this.metaData.defaultOrder)
                this._defaultOrders = this.metaData.defaultOrder!.select((o) => ({
                    column: new ColumnExpression(this, o.property),
                    direction: o.direction
                })).toArray();
            else
                this._defaultOrders = [];
        }
        return this._defaultOrders;
    }
    // tslint:disable-next-line:variable-name
    private _metaData: EntityMetaData<T>;
    // tslint:disable-next-line:variable-name
    private _columns: IColumnExpression[];
    // tslint:disable-next-line:variable-name
    private _defaultOrders: IOrderExpression[];
    constructor(public readonly type: IObjectType<T>, public alias: string) {
    }
    public toString(queryBuilder: QueryBuilder): string {
        return queryBuilder.getEntityQueryString(this);
    }
    public execute(queryBuilder: QueryBuilder): any {
        return queryBuilder.getEntityQueryString(this);
    }
    public has(type: IObjectType<any>) {
        return this.type === type;
    }
    public get(type: IObjectType<any>) {
        if (this.type === type)
            return this;
        return undefined as any;
    }
}
