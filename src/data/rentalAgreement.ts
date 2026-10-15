/**
 * IDIO Digital Camera Rental Agreement Specification & Version Management
 * Location: Butuan City, Agusan del Norte, Philippines
 * Authority: Senior Application Security & Database Architect
 */

export const CURRENT_AGREEMENT_VERSION = 'v1.0';
export const CURRENT_AGREEMENT_ID = 'IDIO-RENTAL-AGREEMENT-2026-V1';
export const CURRENT_AGREEMENT_TITLE = 'IDIO Digital Camera Rental Agreement';
export const CURRENT_AGREEMENT_EFFECTIVE_DATE = '2026-10-15';

export interface AgreementSection {
  id: string;
  title: string;
  content: string;
}

export const CANONICAL_AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    id: 'parties',
    title: '1. Identification of Parties',
    content:
      'This Digital Camera Rental Agreement ("Agreement") is executed between IDIO DIGITAL CAMERA RENTAL ("Owner" / "Lessor"), operating from its equipment hub at J.C. Aquino Avenue, Butuan City, Agusan del Norte, Philippines, and the registered customer ("Customer" / "Lessee") identified in the active reservation record. The Customer confirms they reside in an authorized Butuan City barangay and possesses a valid Philippine government-issued identification card presented during in-person pickup.'
  },
  {
    id: 'equipment',
    title: '2. Digital Camera Asset & Package Accessories',
    content:
      'The Owner agrees to lease, and the Customer agrees to hire, the specific digital camera asset and serial-numbered equipment designated in the reservation. Standard package includes: camera body, manufacturer battery, charging unit, neck/wrist strap, protective lens caps, and approved high-speed SD memory card. All items are verified for operational integrity prior to physical dispatch.'
  },
  {
    id: 'period_and_buffer',
    title: '3. Rental Period & Automatic Two-Calendar-Day Scheduling Buffer',
    content:
      'The contractual rental term begins on the Pickup Date and terminates on the Agreed Return Date specified in the reservation. THE CUSTOMER EXPLICITLY ACKNOWLEDGES AND AGREES THAT THE AUTOMATIC TWO (2) CALENDAR-DAY BUFFER IMMEDIATELY FOLLOWING THE SCHEDULED RETURN DATE IS AN INTERNAL SCHEDULING, OPTICAL SENSOR CLEANING, AND FLEET TURNAROUND PROTECTION MECHANISM FOR IDIO. THE TWO-DAY BUFFER DOES NOT CONSTITUTE AN EXTENSION OF THE RENTAL PERIOD, DOES NOT PERMIT EXTENDED CUSTODY, AND IS NOT CHARGED TO THE CUSTOMER. Equipment must be physically returned to the Butuan City Hub on or before the agreed return date.'
  },
  {
    id: 'fees_and_deposit',
    title: '4. Rental Tariffs & Security Deposit Settlement',
    content:
      'Rental tariffs are calculated authoritatively based on the daily rental rate multiplied strictly by the contractual rental days. The buffer days carry no rental charge. The Customer agrees to pay the total rental tariff plus the mandatory refundable security deposit in CASH ON COUNTER PICKUP (CASH_PICKUP) at the Butuan City Hub during physical equipment checkout. No advance online payment is required for new bookings.'
  },
  {
    id: 'care_and_handling',
    title: '5. Proper Digital Camera Care & Handling Standards',
    content:
      'The Customer shall operate digital camera equipment with high professional care. Cameras must not be exposed to water submersion, rain without weather sealing, direct beach sand, corrosive chemicals, or extreme thermal conditions. Lens changes must be performed in clean, dust-free environments to protect the image sensor. The Customer shall not tamper with, service, disassemble, or sub-lease the camera equipment to third parties.'
  },
  {
    id: 'return_and_inspection',
    title: '6. Counter Return Requirements & Condition Inspection',
    content:
      'The Customer must return equipment in person to the IDIO Butuan City Hub on or before the Agreed Return Date during counter operating hours. A joint physical inspection and test sequence (power on, shutter test, sensor visual check, LCD/EVF check, accessory count) will be conducted by the Counter Administrator and Customer. Camera condition will be graded as Excellent, Good, Fair, or Damaged.'
  },
  {
    id: 'late_returns',
    title: '7. Overdue & Late Equipment Returns',
    content:
      'Equipment retained past the Agreed Return Date without prior written administrative approval is categorized as OVERDUE. Overdue cameras remain blocked from the fleet and cannot be rented to other parties. Daily rental rates continue to accrue for each overdue day. Any late penalty schedules or enforcement measures are subject to express Owner approval before assessment.'
  },
  {
    id: 'damage_and_loss',
    title: '8. Equipment Damage, Scratches, Sensor Defects & Loss',
    content:
      'The Customer is financially responsible for physical damage, cracked optical elements, scratched low-pass filters/sensors, liquid ingress, or total equipment loss occurring during their rental possession. Repair costs, professional servicing expenses, and replacement values require formal Owner review and approval based on official service center quotations.'
  },
  {
    id: 'deposit_settlement',
    title: '9. Security Deposit Deductions & Settlement',
    content:
      'The refundable security deposit held during checkout shall be returned in full in cash upon completion of a clean return inspection. In the event of damage, missing accessories, or overdue charges, deposit deductions or forfeitures require Owner approval and documentation in the return inspection ledger.'
  },
  {
    id: 'cancellation',
    title: '10. Reservation Cancellation & Revisions',
    content:
      'The Customer may cancel a reservation without penalty while it remains in PENDING_APPROVAL status. Once an approved reservation is checked out, standard return procedures apply. Because settlement occurs in cash at counter pickup, no online cancellation fees or merchant processing charges apply.'
  },
  {
    id: 'jurisdiction',
    title: '11. Governing Law & Dispute Resolution',
    content:
      'This Agreement shall be construed and governed in accordance with the laws of the Republic of the Philippines. Any legal action, dispute, or claim arising out of or related to this Agreement shall be brought exclusively before the proper courts of Butuan City, Agusan del Norte, Philippines.'
  },
  {
    id: 'acceptance',
    title: '12. Customer Electronic Acknowledgement & Acceptance',
    content:
      'By checking the acceptance checkbox and submitting the reservation form, the Customer certifies that they have read, understood, and agreed to all provisions of this IDIO Digital Camera Rental Agreement (Version v1.0). The Customer agrees that their digital acceptance constitutes a binding electronic record under Philippine law (Republic Act No. 8792).'
  }
];

/**
 * Returns full concatenated text for the current agreement version.
 */
export function getCanonicalAgreementText(): string {
  return [
    `================================================================================`,
    `${CURRENT_AGREEMENT_TITLE} (Version ${CURRENT_AGREEMENT_VERSION})`,
    `Effective Date: ${CURRENT_AGREEMENT_EFFECTIVE_DATE}`,
    `Location: Butuan City, Agusan del Norte, Philippines`,
    `================================================================================\n`,
    ...CANONICAL_AGREEMENT_SECTIONS.map(s => `${s.title}\n${s.content}\n`)
  ].join('\n');
}

/**
 * Generates an immutable snapshot of agreement text customized for a specific reservation.
 */
export function generateReservationAgreementSnapshot(params: {
  referenceNo: string;
  customerName: string;
  customerPhone?: string;
  customerBarangay: string;
  cameraName: string;
  cameraSerial?: string;
  startDate: string;
  endDate: string;
  bufferEndDate?: string;
  totalDays: number;
  dailyRate: number;
  subtotal: number;
  securityDeposit: number;
  totalAmount: number;
}): string {
  return [
    `================================================================================`,
    `${CURRENT_AGREEMENT_TITLE} — ACCEPTED RECORD`,
    `Agreement Version: ${CURRENT_AGREEMENT_VERSION} | Identifier: ${CURRENT_AGREEMENT_ID}`,
    `Reservation Reference: ${params.referenceNo}`,
    `Effective Date: ${CURRENT_AGREEMENT_EFFECTIVE_DATE}`,
    `Operating Hub: J.C. Aquino Avenue, Butuan City, Agusan del Norte, Philippines`,
    `================================================================================\n`,
    `LESSOR: IDIO Digital Camera Rental Management System`,
    `LESSEE: ${params.customerName} (Barangay ${params.customerBarangay}, Butuan City)`,
    `CAMERA ASSET: ${params.cameraName} ${params.cameraSerial ? `(SN: ${params.cameraSerial})` : ''}`,
    `RENTAL DURATION: ${params.startDate} to ${params.endDate} (${params.totalDays} Rental Day${params.totalDays > 1 ? 's' : ''})`,
    `SCHEDULED TURNAROUND BUFFER: 2 Calendar Days after agreed return (Not Charged)`,
    `TARIFF: PHP ${params.dailyRate.toLocaleString()} / day | Subtotal: PHP ${params.subtotal.toLocaleString()}`,
    `REFUNDABLE SECURITY DEPOSIT: PHP ${params.securityDeposit.toLocaleString()} (Cash on Counter Pickup)`,
    `TOTAL DUE AT PICKUP: PHP ${params.totalAmount.toLocaleString()}\n`,
    `--------------------------------------------------------------------------------`,
    `TERMS AND CONDITIONS (VERSION ${CURRENT_AGREEMENT_VERSION}):`,
    `--------------------------------------------------------------------------------\n`,
    ...CANONICAL_AGREEMENT_SECTIONS.map(s => `${s.title}\n${s.content}\n`)
  ].join('\n');
}
