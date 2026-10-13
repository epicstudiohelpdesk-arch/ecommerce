import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type {
  IShippingProvider,
  ShippingProviderCode,
  BookShipmentProviderParams,
  BookShipmentProviderResult,
  ShippingLabelDetails,
  ShippingLabelResult,
  SchedulePickupProviderParams,
  SchedulePickupProviderResult,
  CancelShipmentProviderResult,
  TrackingDetailsResult,
  ServiceabilityResult,
} from '../interfaces/shipping-provider.interface';

@Injectable()
export class MockCourierProvider implements IShippingProvider {
  readonly providerCode: ShippingProviderCode = 'MOCK_COURIER';
  readonly carrierName: string = 'Mock Express Logistics';
  private readonly logger = new Logger(MockCourierProvider.name);
  private readonly webhookSecret: string =
    process.env['MOCK_COURIER_WEBHOOK_SECRET'] || 'test-mock-courier-secret-key-12345';

  async checkServiceability(
    originPostalCode: string,
    destPostalCode: string,
  ): Promise<ServiceabilityResult> {
    const isSpecialRemote = destPostalCode.startsWith('999');
    return {
      serviceable: !isSpecialRemote,
      originPostalCode,
      destinationPostalCode: destPostalCode,
      carrierCode: this.providerCode,
      estimatedDeliveryDays: 3,
      codAvailable: false,
    };
  }

  async bookShipment(params: BookShipmentProviderParams): Promise<BookShipmentProviderResult> {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const waybillNumber = `MCK${randomSuffix}`;
    const trackingNumber = `TRK-MCK-${randomSuffix}`;

    this.logger.log(
      `Mock courier shipment booked: waybill=${waybillNumber}, tracking=${trackingNumber} for subOrder=${params.subOrderNumber}`,
    );

    return {
      waybillNumber,
      trackingNumber,
      labelUrl: `/api/v1/shipping/labels/${waybillNumber}`,
      pickupToken: `PKP-${randomSuffix}`,
      estimatedDeliveryDays: 3,
      carrierMetadata: {
        courier: this.carrierName,
        serviceType: 'EXPRESS_SURFACE',
        zone: 'DOMESTIC_NORTH',
        routingCode: `${params.originAddress.postalCode.slice(0, 3)}-${params.destinationAddress.postalCode.slice(0, 3)}`,
      },
    };
  }

  async generateShippingLabel(details: ShippingLabelDetails): Promise<ShippingLabelResult> {
    const contentHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shipping Label - ${details.waybillNumber}</title>
  <style>
    body { font-family: monospace, sans-serif; margin: 0; padding: 16px; background: #fff; color: #000; }
    .label-box { border: 2px solid #000; width: 400px; padding: 12px; margin: auto; }
    .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 18px; font-weight: bold; }
    .awb { font-size: 16px; font-weight: bold; text-align: center; margin: 12px 0; letter-spacing: 2px; }
    .barcode { background: #eee; text-align: center; padding: 8px; font-size: 20px; font-weight: bold; letter-spacing: 4px; border: 1px dashed #000; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; font-size: 11px; }
    .section-title { font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    .footer { border-top: 1px solid #000; padding-top: 8px; font-size: 10px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="label-box">
    <div class="header">
      <span class="title">${details.carrierName}</span>
      <span>PREPAID EXPRESS</span>
    </div>
    <div class="barcode">||| | |||| | |||||| || | ||||</div>
    <div class="awb">AWB: ${details.waybillNumber}</div>
    <div class="grid">
      <div>
        <div class="section-title">SHIP TO (CONSIGNEE):</div>
        <div><strong>${details.destinationAddress.name}</strong></div>
        <div>${details.destinationAddress.line1}</div>
        ${details.destinationAddress.line2 ? `<div>${details.destinationAddress.line2}</div>` : ''}
        <div>${details.destinationAddress.city}, ${details.destinationAddress.state}</div>
        <div><strong>PIN: ${details.destinationAddress.postalCode}</strong></div>
        <div>Tel: ${details.destinationAddress.phone}</div>
      </div>
      <div>
        <div class="section-title">SHIP FROM (CONSIGNOR):</div>
        <div><strong>${details.originAddress.name}</strong></div>
        <div>${details.originAddress.line1}</div>
        <div>${details.originAddress.city}, ${details.originAddress.state}</div>
        <div><strong>PIN: ${details.originAddress.postalCode}</strong></div>
        <div>Tel: ${details.originAddress.phone}</div>
      </div>
    </div>
    <div style="font-size: 11px; margin: 8px 0; border-top: 1px dashed #000; padding-top: 4px;">
      <div>Sub-Order: <strong>${details.subOrderNumber}</strong> (Parent: ${details.parentOrderNumber})</div>
      <div>Weight: <strong>${details.weightGrams}g</strong> | Dim: ${details.dimensionsMm.length}x${details.dimensionsMm.width}x${details.dimensionsMm.height} mm</div>
    </div>
    <div class="footer">
      <span>Generated by Handcrafted Marketplace</span>
      <span>${new Date().toISOString().split('T')[0]}</span>
    </div>
  </div>
</body>
</html>
    `.trim();

    return {
      labelUrl: `/api/v1/shipping/labels/${details.waybillNumber}`,
      contentHtml,
    };
  }

  async schedulePickup(
    params: SchedulePickupProviderParams,
  ): Promise<SchedulePickupProviderResult> {
    const pickupToken = `PKP-CONF-${Math.floor(100000 + Math.random() * 900000)}`;
    this.logger.log(
      `Pickup scheduled for AWB ${params.waybillNumber} on ${params.pickupDate}, token: ${pickupToken}`,
    );

    return {
      pickupScheduled: true,
      pickupToken,
      confirmedDate: params.pickupDate,
      carrierMetadata: {
        timeSlot: params.timeSlot || '10:00 - 14:00',
        pickupAgentPhone: '+91 98765 43210',
      },
    };
  }

  async cancelShipment(
    waybillNumber: string,
    reason: string,
  ): Promise<CancelShipmentProviderResult> {
    this.logger.log(`Shipment ${waybillNumber} cancelled with mock courier: ${reason}`);
    return {
      cancelled: true,
      cancellationReference: `CNL-${Math.floor(100000 + Math.random() * 900000)}`,
      message: `Shipment ${waybillNumber} successfully cancelled with carrier.`,
    };
  }

  async fetchTracking(waybillNumber: string): Promise<TrackingDetailsResult> {
    const now = new Date();
    return {
      waybillNumber,
      trackingNumber: `TRK-${waybillNumber}`,
      currentStatus: 'IN_TRANSIT',
      carrier: this.providerCode,
      estimatedDeliveryDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      milestones: [
        {
          status: 'LABEL_CREATED',
          location: 'Origin Facility',
          description: 'Shipment record created, awaiting courier dispatch',
          eventTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
        {
          status: 'IN_TRANSIT',
          location: 'Regional Sorting Hub',
          description: 'Package scanned at sorting center',
          eventTime: now,
        },
      ],
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean {
    const expectedSecret = secret || this.webhookSecret;
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const computed = crypto.createHmac('sha256', expectedSecret).update(bodyStr).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Helper utility for testing to generate valid HMAC signature for mock courier webhook payloads
   */
  signPayload(payload: string | object, secret?: string): string {
    const expectedSecret = secret || this.webhookSecret;
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', expectedSecret).update(bodyStr).digest('hex');
  }
}
