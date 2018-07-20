import "reflect-metadata";
import { IObjectType } from "../../Common/Type";
import { entityMetaKey } from "../DecoratorKey";
import { AbstractEntity } from "../Entity/AbstractEntity";
import { ISaveEventParam } from "../../MetaData/Interface/ISaveEventParam";
import { IEntityMetaData } from "../../MetaData/Interface/IEntityMetaData";
/**
 * Register before save event. only for concrete entity
 */
export function AfterSave<T = any>(handler?: (this: T, param: ISaveEventParam) => void): MethodDecorator | ClassDecorator {
    return (target: object | IObjectType<T>, propertyKey?: string /* | symbol*/, descriptor?: PropertyDescriptor) => {
        const ctor = (propertyKey ? target.constructor : target) as ObjectConstructor;
        let entityMetaData: IEntityMetaData<any> = Reflect.getOwnMetadata(entityMetaKey, ctor);
        if (!entityMetaData) {
            AbstractEntity()(ctor);
            entityMetaData = Reflect.getOwnMetadata(entityMetaKey, target.constructor);
        }

        if (!handler && descriptor && typeof descriptor.value === "function")
            handler = descriptor.value;

        if (handler)
            entityMetaData.afterSave = handler;
    };
}
