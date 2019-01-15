import { DbContext } from "../../Data/DBContext";
import { DeferredQuery } from "../../QueryBuilder/DeferredQuery";
import { MockConnection } from "./MockConnection";
import { PooledConnection } from "../PooledConnection";
import { IConnection } from "../IConnection";

export interface IMockedContext {
    oriExecuteDeferred?(deferredQueries: Iterable<DeferredQuery>): Promise<void>;
    oriGetConnection?(writable?: boolean): Promise<IConnection>;
}
export const mockContext = function (context: DbContext & IMockedContext) {
    context.oriGetConnection = context.getConnection;
    context.getConnection = async function (writable?: boolean) {
        let connection = await this.oriGetConnection(writable);
        if (connection instanceof PooledConnection) {
            if (!(connection.connection instanceof MockConnection)) {
                connection.connection = new MockConnection(connection.database);
            }
        }
        else if (!(connection instanceof MockConnection)) {
            connection = new MockConnection(connection.database);
        }
        return connection;
    };
    context.oriExecuteDeferred = context.executeDeferred;
    context.executeDeferred = async function (deferredQueries?: Iterable<DeferredQuery>) {
        if (!deferredQueries) deferredQueries = context.deferredQueries.splice(0);
        this.connection = await this.getConnection();
        const mockConnection: MockConnection = this.connection instanceof PooledConnection ? this.connection.connection as any : this.connection as any;
        mockConnection.deferredQueries = deferredQueries;
        return context.oriExecuteDeferred.apply(this, [deferredQueries]);
    };
};

export function restore(context: DbContext & IMockedContext) {
    context.getConnection = context.oriGetConnection;
    context.oriGetConnection = undefined;
    context.executeDeferred = context.oriExecuteDeferred;
    context.oriExecuteDeferred = undefined;
}