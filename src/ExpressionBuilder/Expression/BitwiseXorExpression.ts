import { ExpressionTransformer } from "../ExpressionTransformer";
import { BitwiseExpression } from "./BitwiseExpression";
import { IBinaryOperatorExpression } from "./IBinaryOperatorExpression";
import { IExpression } from "./IExpression";
import { ValueExpression } from "./ValueExpression";
export class BitwiseXorExpression extends BitwiseExpression implements IBinaryOperatorExpression {
    public static Create(leftOperand: IExpression, rightOperand: IExpression) {
        const result = new BitwiseXorExpression(leftOperand, rightOperand);
        if (leftOperand instanceof ValueExpression && rightOperand instanceof ValueExpression)
            return ValueExpression.Create<number>(result);

        return result;
    }
    public leftOperand: IExpression<number>;
    public rightOperand: IExpression<number>;
    constructor(leftOperand: IExpression, rightOperand: IExpression) {
        super();
        this.leftOperand = this.convertOperand(leftOperand);
        this.rightOperand = this.convertOperand(rightOperand);
    }

    public toString(transformer: ExpressionTransformer): string {
        return "(" + this.leftOperand.toString(transformer) + " ^ " + this.rightOperand.toString(transformer) + ")";
    }
    public execute(transformer: ExpressionTransformer) {
        // tslint:disable-next-line:no-bitwise
        return this.leftOperand.execute(transformer) ^ this.rightOperand.execute(transformer);
    }
}
