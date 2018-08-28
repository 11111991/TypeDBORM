import { DbSet } from "./DbSet";
import { EntityEntry } from "./EntityEntry";
import { IChangeEventParam } from "../MetaData/Interface/IChangeEventParam";
import { EmbeddedColumnMetaData } from "../MetaData/EmbeddedColumnMetaData";
import { EntityState } from "./EntityState";
import { EventHandlerFactory } from "../Event/EventHandlerFactory";
import { IEventHandler } from "../Event/IEventHandler";
import { propertyChangeHandlerMetaKey, propertyChangeDispatherMetaKey } from "../Decorator/DecoratorKey";

export class EmbeddedEntityEntry<T = any, TP = any> extends EntityEntry<T> {
    public column: EmbeddedColumnMetaData<TP, T>;
    constructor(public dbSet: DbSet<T>, public entity: T, public parentEntry: EntityEntry<TP>) {
        super(dbSet, entity, null);
        let propertyChangeHandler: IEventHandler<T> = Reflect.getOwnMetadata(propertyChangeHandlerMetaKey, entity);
        if (!propertyChangeHandler) {
            let propertyChangeDispatcher: any;
            [propertyChangeHandler, propertyChangeDispatcher] = EventHandlerFactory<T, IChangeEventParam<T>>(entity);
            Reflect.defineMetadata(propertyChangeHandlerMetaKey, propertyChangeHandler, entity);
            Reflect.defineMetadata(propertyChangeDispatherMetaKey, propertyChangeDispatcher, entity);
        }
        propertyChangeHandler.add(this.onPropertyChanged);

        let parentPropertyChangeHandler: IEventHandler<TP> = Reflect.getOwnMetadata(propertyChangeHandlerMetaKey, parentEntry.entity);
        if (!parentPropertyChangeHandler) {
            parentPropertyChangeHandler.add(this.onParentPropertyChange);
        }
    }
    private onParentPropertyChange(entity: TP, param: IChangeEventParam<TP, T>) {
        if (param.column === this.column) {
            if (param.oldValue === this.entity) {
                const parentChangeHandler: IEventHandler<TP, IChangeEventParam> = Reflect.getOwnMetadata(propertyChangeHandlerMetaKey, this.parentEntry.entity);
                if (parentChangeHandler) {
                    parentChangeHandler.remove(this.onParentPropertyChange);
                }
                this.changeState(EntityState.Detached);
            }
        }
    }
}