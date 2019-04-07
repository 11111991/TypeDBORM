import "reflect-metadata";
import { TimeZoneHandling } from "../../Common/Type";
import { Column } from "./Column";
import { DateTimeColumnType } from "../../Common/ColumnType";
import { IDateTimeColumnOption } from "../Option/IDateTimeColumnOption";
import { DateTimeColumnMetaData } from "../../MetaData/DateTimeColumnMetaData";

export function ModifiedDateColumn(option?: IDateTimeColumnOption): PropertyDecorator;
export function ModifiedDateColumn(name: string, dbtype: DateTimeColumnType, timeZoneHandling?: TimeZoneHandling): PropertyDecorator;
export function ModifiedDateColumn(optionOrName?: IDateTimeColumnOption | string, dbtype?: DateTimeColumnType, timeZoneHandling?: TimeZoneHandling): PropertyDecorator {
    let option: IDateTimeColumnOption = {};
    if (optionOrName) {
        if (typeof optionOrName === "string") {
            option.columnName = optionOrName;
            if (timeZoneHandling !== undefined) option.timeZoneHandling = timeZoneHandling;
            if (dbtype !== undefined) option.columnType = dbtype;
        }
        else {
            option = optionOrName;
        }
    }
    option.isModifiedDate = true;
    if (option.timeZoneHandling === "none")
        /* istanbul ignore next */
        option.default = () => Date.timestamp();
    else
        /* istanbul ignore next */
        option.default = () => Date.utcTimestamp();
    return Column<any, Date>(DateTimeColumnMetaData, option);
}
