import { Injectable } from '@nestjs/common';

/**
 * Plan Lookup Service
 *
 * This service should be integrated with your plans API/service
 * to fetch the stripe_price_id based on plan_id and billing_interval.
 *
 * Example implementation:
 * - Call your GET /plans endpoint
 * - Find the plan by plan_id
 * - Extract the stripe_price_id from pricing[billing_interval]
 */
@Injectable()
export class PlanLookupService {
  /**
   * Get Stripe Price ID for a given plan and billing interval
   *
   * TODO: Integrate with your plans service/API
   * This is a placeholder that you should replace with actual plan lookup logic
   */
  getPriceId(planId: string, billingInterval: 'month' | 'year'): Promise<string> {
    // TODO: Implement actual plan lookup
    // Example:
    // const plans = await this.httpService.get('/plans').toPromise();
    // const plan = plans.data.plans.find(p => p.key === planId);
    // return plan.pricing[billingInterval].stripe_price_id;

    throw new Error(
      `Plan lookup not implemented. Please integrate with your plans service to get price_id for plan: ${planId}, interval: ${billingInterval}`,
    );
  }
}
