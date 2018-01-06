import { ExpressionTransformer } from "../ExpressionTransformer";
import { IBinaryOperatorExpression } from "./IBinaryOperatorExpression";
import { ExpressionBase, IExpression } from "./IExpression";
import { ValueExpression } from "./ValueExpression";
export class LessThanExpression<TType> extends ExpressionBase<boolean> implements IBinaryOperatorExpression {
    public static Create<TType>(leftOperand: IExpression<TType>, rightOperand: IExpression<TType>) {
        const result = new LessThanExpression(leftOperand, rightOperand);
        if (leftOperand instanceof ValueExpression && rightOperand instanceof ValueExpression)
            return ValueExpression.Create<boolean>(result);

        return result;
    }
    constructor(public leftOperand: IExpression<TType>, public rightOperand: IExpression<TType>) {
        super(Boolean);
    }

    public toString(transformer: ExpressionTransformer): string {
        return "(" + this.leftOperand.toString(transformer) + " < " + this.rightOperand.toString(transformer) + ")";
    }
    public execute(transformer: ExpressionTransformer) {
        return this.leftOperand.execute(transformer) < this.rightOperand.execute(transformer);
    }
}
