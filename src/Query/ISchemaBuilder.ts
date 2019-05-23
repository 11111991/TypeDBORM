import { IObjectType } from "../Common/Type";
import { IConnection } from "../Connection/IConnection";
import { IEntityMetaData } from "../MetaData/Interface/IEntityMetaData";
import { IQueryBuilder } from "./IQueryBuilder";
import { ISchemaBuilderOption } from "./ISchemaBuilderOption";
import { ISchemaQuery } from "./ISchemaQuery";

export interface ISchemaBuilder {
    connection: IConnection;
    queryBuilder: IQueryBuilder;
    option: ISchemaBuilderOption;
    getSchemaQuery(entityTypes: IObjectType[]): Promise<ISchemaQuery>;
    loadSchemas(entities: Array<IEntityMetaData<any>>): Promise<IEntityMetaData[]>;
}
