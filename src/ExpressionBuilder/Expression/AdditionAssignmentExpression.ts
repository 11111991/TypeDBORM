import { ExpressionTransformer } from "../ExpressionTransformer";
import { IBinaryOperatorExpression } from "./IBinaryOperatorExpression";
import { ExpressionBase, IExpression } from "./IExpression";
import { ParameterExpression } from "./ParameterExpression";
import { MethodCallExpression } from "./MethodCallExpression";
import { resolveClone, hashCode, hashCodeAdd } from "../../Helper/Util";
export class AdditionAssignmentExpression<T extends number | string = number | string> extends ExpressionBase<T> implements IBinaryOperatorExpression {
    public static create(leftOperand: ParameterExpression, rightOperand: IExpression) {
        return new AdditionAssignmentExpression(leftOperand, rightOperand);
    }
    constructor(public leftOperand: ParameterExpression, public rightOperand: IExpression) {
        super(rightOperand.type);
        if (leftOperand.type === String) {
            this.rightOperand = this.convertToStringOperand(rightOperand) as any;
        }
    }
    protected convertToStringOperand(operand: IExpression): IExpression<string> {
        if (operand.type !== String) {
            operand = new MethodCallExpression(operand, "toString", []);
        }
        return operand as any;
    }
    public toString(transformer?: ExpressionTransformer): string {
        if (transformer)
            return transformer.getExpressionString(this);
        return "(" + this.leftOperand.toString() + " += " + this.rightOperand.toString() + ")";
    }
    public execute(transformer: ExpressionTransformer) {
        const value = this.rightOperand.execute(transformer);
        transformer.scopeParameters.remove(this.leftOperand.name);
        transformer.scopeParameters.add(this.leftOperand.name, transformer.scopeParameters.get(this.leftOperand.name) + value);
        return value;
    }
    public clone(replaceMap?: Map<IExpression, IExpression>) {
        if (!replaceMap) replaceMap = new Map();
        const left = resolveClone(this.leftOperand, replaceMap);
        const right = resolveClone(this.rightOperand, replaceMap);
        const clone = new AdditionAssignmentExpression<T>(left, right);
        replaceMap.set(this, clone);
        return clone;
    }
    public hashCode() {
        return hashCodeAdd(hashCode("+=", this.leftOperand.hashCode()), this.rightOperand.hashCode());
    }
}
