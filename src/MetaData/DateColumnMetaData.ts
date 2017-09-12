import { ColumnMetaData } from "./ColumnMetaData";
export class DateColumnMetadata extends ColumnMetaData<Date> {
    public dbtype: "date" | "datetime";
    public dateTimeKind: "UTC" | "Unspecified";
    /*
    * UTC TimeZone offset in minute.
    */
    public timezoneOffset: number;
    constructor() {
        super(Date);
    }
}
