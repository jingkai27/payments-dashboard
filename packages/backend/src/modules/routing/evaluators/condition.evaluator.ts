import {
  RoutingContext,
  RuleCondition,
  RoutingRuleConditions,
  ConditionOperator,
} from '../routing.types.js';
import { logger } from '../../../shared/utils/logger.js';

export class ConditionEvaluator {
  evaluate(conditions: RoutingRuleConditions, context: RoutingContext): boolean {
    // Handle "all" conditions (AND logic)
    if (conditions.all && conditions.all.length > 0) {
      const allMatch = conditions.all.every((condition) =>
        this.evaluateCondition(condition, context)
      );
      if (!allMatch) return false;
    }

    // Handle "any" conditions (OR logic)
    if (conditions.any && conditions.any.length > 0) {
      const anyMatch = conditions.any.some((condition) =>
        this.evaluateCondition(condition, context)
      );
      if (!anyMatch) return false;
    }

    // Handle individual field conditions (support both simple and full formats)
    if (conditions.currency) {
      if (!this.evaluateFieldCondition('currency', conditions.currency, context)) return false;
    }

    if (conditions.amount) {
      if (!this.evaluateFieldCondition('amount', conditions.amount, context)) return false;
    }

    if (conditions.paymentMethodType) {
      if (!this.evaluateFieldCondition('paymentMethodType', conditions.paymentMethodType, context)) return false;
    }

    if (conditions.cardBrand) {
      if (!this.evaluateFieldCondition('cardBrand', conditions.cardBrand, context)) return false;
    }

    if (conditions.country) {
      if (!this.evaluateFieldCondition('country', conditions.country, context)) return false;
    }

    if (conditions.region) {
      if (!this.evaluateFieldCondition('region', conditions.region, context)) return false;
    }

    // Handle legacy simple conditions (e.g., { amountMin: 0, amountMax: 1000000 })
    const rawConditions = conditions as Record<string, unknown>;
    if (rawConditions.amountMin !== undefined || rawConditions.amountMax !== undefined) {
      const amount = Number(context.amount);
      if (rawConditions.amountMin !== undefined && amount < Number(rawConditions.amountMin)) {
        return false;
      }
      if (rawConditions.amountMax !== undefined && amount > Number(rawConditions.amountMax)) {
        return false;
      }
    }

    return true;
  }

  private evaluateFieldCondition(
    fieldName: string,
    condition: RuleCondition | unknown,
    context: RoutingContext
  ): boolean {
    // If condition is a simple value (legacy format), compare directly
    if (typeof condition !== 'object' || condition === null || !('field' in condition)) {
      const fieldValue = this.getFieldValue(fieldName, context);
      return this.isEqual(fieldValue, condition);
    }

    // Full RuleCondition format
    return this.evaluateCondition(condition as RuleCondition, context);
  }

  private evaluateCondition(condition: RuleCondition, context: RoutingContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);
    const conditionValue = condition.value;

    try {
      return this.compareValues(fieldValue, condition.operator, conditionValue);
    } catch (error) {
      logger.warn('Error evaluating condition', {
        field: condition.field,
        operator: condition.operator,
        error: (error as Error).message,
      });
      return false;
    }
  }

  private getFieldValue(field: string, context: RoutingContext): unknown {
    switch (field) {
      case 'currency':
        return context.currency;
      case 'amount':
        return context.amount;
      case 'paymentMethodType':
        return context.paymentMethodType;
      case 'cardBrand':
        return context.cardBrand;
      case 'country':
        return context.country;
      case 'region':
        return context.region;
      case 'merchantId':
        return context.merchantId;
      case 'customerId':
        return context.customerId;
      default:
        // Check in metadata
        if (field.startsWith('metadata.') && context.metadata) {
          const metaKey = field.substring(9);
          return context.metadata[metaKey];
        }
        return undefined;
    }
  }

  private compareValues(
    fieldValue: unknown,
    operator: ConditionOperator,
    conditionValue: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return this.isEqual(fieldValue, conditionValue);

      case 'not_equals':
        return !this.isEqual(fieldValue, conditionValue);

      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);

      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);

      case 'greater_than':
        return this.toNumber(fieldValue) > this.toNumber(conditionValue);

      case 'less_than':
        return this.toNumber(fieldValue) < this.toNumber(conditionValue);

      case 'greater_than_or_equals':
        return this.toNumber(fieldValue) >= this.toNumber(conditionValue);

      case 'less_than_or_equals':
        return this.toNumber(fieldValue) <= this.toNumber(conditionValue);

      case 'between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2) {
          const numValue = this.toNumber(fieldValue);
          const min = this.toNumber(conditionValue[0]);
          const max = this.toNumber(conditionValue[1]);
          return numValue >= min && numValue <= max;
        }
        return false;

      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          typeof conditionValue === 'string' &&
          fieldValue.toLowerCase().includes(conditionValue.toLowerCase())
        );

      case 'starts_with':
        return (
          typeof fieldValue === 'string' &&
          typeof conditionValue === 'string' &&
          fieldValue.toLowerCase().startsWith(conditionValue.toLowerCase())
        );

      case 'ends_with':
        return (
          typeof fieldValue === 'string' &&
          typeof conditionValue === 'string' &&
          fieldValue.toLowerCase().endsWith(conditionValue.toLowerCase())
        );

      default:
        return false;
    }
  }

  private isEqual(a: unknown, b: unknown): boolean {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
      return BigInt(a as string | number | bigint) === BigInt(b as string | number | bigint);
    }
    return a === b;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    throw new Error(`Cannot convert ${value} to number`);
  }
}

export const conditionEvaluator = new ConditionEvaluator();
