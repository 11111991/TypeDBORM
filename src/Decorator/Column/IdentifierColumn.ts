import "reflect-metadata";
import { Column } from "./Column";
import { IdentifierColumnMetaData } from "../../MetaData/IdentifierColumnMetaData";
import { IIdentityColumnOption } from "../Option/IIdentityColumnOption";
import { UUID } from "../../Data/UUID";

export function IdentifierColumn(option?: IIdentityColumnOption): PropertyDecorator;
export function IdentifierColumn(name: string, defaultValue?: () => UUID): PropertyDecorator;
export function IdentifierColumn(optionOrName?: string | IIdentityColumnOption, defaultValue?: () => UUID): PropertyDecorator {
    let option: IIdentityColumnOption = {};
    if (optionOrName && typeof optionOrName !== "string") {
        option = optionOrName;
    }
    else {
        if (typeof optionOrName !== "undefined")
            option.columnName = optionOrName as string;
        if (typeof defaultValue !== "undefined")
            option.default = defaultValue;
    }
    return Column<any, UUID>(IdentifierColumnMetaData, option);
}
