import { IDeleteEventParam } from "../../MetaData/Interface/IDeleteEventParam";
import { ISaveEventParam } from "../../MetaData/Interface/ISaveEventParam";

export interface IDBEventListener<T = any> {
    beforeSave?: (entity: T, param: ISaveEventParam) => boolean;
    beforeDelete?: (entity: T, param: IDeleteEventParam) => boolean;
    afterLoad?: (entity: T) => void;
    afterSave?: (entity: T, param: ISaveEventParam) => void;
    afterDelete?: (entity: T, param: IDeleteEventParam) => void;
}
