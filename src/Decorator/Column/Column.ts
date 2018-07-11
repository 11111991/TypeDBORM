import "reflect-metadata";
import "../../Extensions/EnumerableExtension";
import { columnMetaKey, entityMetaKey } from "../DecoratorKey";
import { IChangeEventParam } from "../../MetaData/Interface/IChangeEventParam";
import { IObjectType } from "../../Common/Type";
import { IEventDispacher } from "../../Event/IEventHandler";
import { ColumnMetaData } from "../../MetaData/ColumnMetaData";
import { IEntityMetaData } from "../../MetaData/Interface/IEntityMetaData";
import { AbstractEntity } from "../Entity/AbstractEntity";
import { IColumnOption } from "../Option/IColumnOption";
import { DateColumnMetaData } from "../../MetaData/DateColumnMetaData";
import { BooleanColumnMetaData } from "../../MetaData/BooleanColumnMetaData";

export function Column<TE = any, T = any>(columnMetaType: IObjectType<ColumnMetaData<TE, T>>, columnOption: IColumnOption): PropertyDecorator {
    return (target: TE, propertyKey: any) => {
        let entityMetaData: IEntityMetaData<any> = Reflect.getOwnMetadata(entityMetaKey, target.constructor);
        if (!entityMetaData) {
            AbstractEntity()(target.constructor as ObjectConstructor);
            entityMetaData = Reflect.getOwnMetadata(entityMetaKey, target.constructor);
        }

        const metadata = new columnMetaType();
        metadata.applyOption(columnOption as any);
        if (!metadata.columnName) {
            if (typeof (propertyKey) === "string")
                metadata.columnName = propertyKey;
        }
        metadata.propertyName = propertyKey;

        const columnMetaData: ColumnMetaData<TE, T> = Reflect.getOwnMetadata(columnMetaKey, target.constructor, propertyKey);
        if (columnMetaData != null) {
            metadata.applyOption(columnMetaData);
            entityMetaData.columns.remove(columnMetaData);
        }
        Reflect.defineMetadata(columnMetaKey, metadata, target.constructor, propertyKey);
        entityMetaData.columns.push(metadata);

        const pk = entityMetaData.primaryKeys.first(o => o.propertyName === metadata.propertyName);
        if (pk) {
            entityMetaData.primaryKeys.remove(pk);
            entityMetaData.primaryKeys.push(metadata);
        }

        if (metadata instanceof DateColumnMetaData) {
            if (columnOption.isCreatedDate)
                entityMetaData.createDateColumn = metadata;
            else if (columnOption.isModifiedDate)
                entityMetaData.modifiedDateColumn = metadata;
        }
        else if (metadata instanceof BooleanColumnMetaData) {
            if (columnOption.isDeleteColumn)
                entityMetaData.deleteColumn = metadata;
        }

        // add property to use setter getter.
        const privatePropertySymbol = Symbol(propertyKey);
        let descriptor: PropertyDescriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
        let oldGet: any, oldSet: any;
        if (descriptor) {
            if (descriptor.get) {
                oldGet = descriptor.get;
            }
            if (descriptor.set) {
                oldSet = descriptor.set;
            }
        }
        descriptor = {
            set: function (this: any, value: T) {
                if (!oldGet && !this.hasOwnProperty(privatePropertySymbol)) {
                    Object.defineProperty(this, privatePropertySymbol, {
                        value: undefined,
                        enumerable: false,
                        writable: true,
                        configurable: true
                    });
                }
                const oldValue = this[propertyKey];
                // tslint:disable-next-line:triple-equals
                if (oldValue != value) {
                    if (oldSet)
                        oldSet.apply(this, value);
                    else
                        this[privatePropertySymbol] = value;

                    const propertyChangeDispatcher: IEventDispacher<IChangeEventParam<TE>> = Reflect.getOwnMetadata("PropertyChangeEventListener", this);
                    if (propertyChangeDispatcher) {
                        propertyChangeDispatcher({
                            column: columnMetaData,
                            oldValue,
                            newValue: value
                        });
                    }
                }
            },
            get: function (this: any) {
                if (oldGet)
                    return oldGet.apply(this);
                return this[privatePropertySymbol];
            },
            configurable: true,
            enumerable: true
        };

        Object.defineProperty(target, propertyKey, descriptor);
    };
}
