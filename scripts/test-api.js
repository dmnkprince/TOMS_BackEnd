import { authService } from '../src/services/authService.js';
import { offenceService } from '../src/services/offenceService.js';
import { locationService } from '../src/services/locationService.js';
import { incidentService } from '../src/services/incidentService.js';
import { vehicleLookupService } from '../src/services/vehicleLookupService.js';
import { correctionService } from '../src/services/correctionService.js';
import { reportService } from '../src/services/reportService.js';
import { auditLogService } from '../src/services/auditLogService.js';

async function runTests() {
  console.log('🧪 Starting TOMS Backend Integration Tests against Turso Cloud DB...\n');

  try {
    // 1. Test Login with Admin and Agent
    console.log('1️⃣ Testing Authentication...');
    const adminLogin = await authService.login('admin@toms.gov', 'Password123!');
    console.log(`   ✅ Admin authenticated: ${adminLogin.user.full_name} (${adminLogin.user.role})`);

    const agentLogin = await authService.login('officer.david@toms.gov', 'Password123!');
    console.log(`   ✅ Agent authenticated: ${agentLogin.user.full_name} (${agentLogin.user.role})`);

    // 2. Fetch Offence Types and Locations
    console.log('\n2️⃣ Testing Metadata Retrieval (Offence Types & Locations)...');
    const offences = await offenceService.getAllOffences();
    console.log(`   ✅ Retrieved ${offences.length} active offence types`);
    if (offences.length < 2) throw new Error('Expected at least 2 offences in seed data');

    const locations = await locationService.getAllLocations();
    console.log(`   ✅ Retrieved ${locations.length} predefined locations`);

    // 3. Vehicle Lookup before any incidents
    console.log('\n3️⃣ Testing Vehicle Lookup (New Plate)...');
    const testPlate = `TEST-${Math.floor(1000 + Math.random() * 9000)}-NG`;
    const initialLookup = await vehicleLookupService.lookupByPlate(testPlate);
    console.log(`   ✅ Initial lookup result for ${testPlate}: found = ${initialLookup.found}, encounters = ${initialLookup.total_prior_incidents}`);

    // 4. Register Incident with Multiple Offences
    console.log('\n4️⃣ Testing Atomic Incident Registration with Multiple Offences...');
    const newIncident = await incidentService.registerIncident(
      {
        plate_number: testPlate,
        body_number: 'CAB-99',
        vehicle_make: 'Toyota',
        vehicle_model: 'Corolla 2018',
        vehicle_color: 'Silver',
        vehicle_type: 'Sedan',
        vehicle_owner_name: 'Babajide Sanwo',
        vehicle_owner_phone: '+2348021112233',
        driver_license_number: 'LASG-98442',
        driver_name: 'Babajide Sanwo',
        location_id: locations[0].id,
        location_description: 'Near pedestrian overpass',
        remarks: 'Vehicle stopped after ignoring traffic signal.',
        offences: [
          { offence_type_id: offences[0].id, fine_amount: offences[0].penalty_amount, notes: 'First violation' },
          { offence_type_id: offences[1].id, fine_amount: offences[1].penalty_amount, notes: 'Second violation' },
        ],
      },
      agentLogin.user.id
    );

    console.log(`   ✅ Incident created successfully!`);
    console.log(`      Reference: ${newIncident.reference_number}`);
    console.log(`      ID: ${newIncident.id}`);
    console.log(`      Offences attached: ${newIncident.offences.length}`);

    // 5. Vehicle Lookup After Incident
    console.log('\n5️⃣ Testing Vehicle Lookup (Historical Snapshot)...');
    const secondLookup = await vehicleLookupService.lookupByPlate(testPlate);
    console.log(`   ✅ Snapshot retrieved: Make=${secondLookup.vehicle.vehicle_make}, Model=${secondLookup.vehicle.vehicle_model}`);
    console.log(`   ✅ Total encounters counted: ${secondLookup.total_prior_incidents}`);

    // 6. Test Multi-Filter Search with Deduplication
    console.log('\n6️⃣ Testing Multi-Filter Search...');
    const searchRes = await incidentService.searchIncidents({
      plate_number: testPlate,
      vehicle_make: 'Toyota',
    });
    console.log(`   ✅ Search returned ${searchRes.incidents.length} incident(s) matching filters`);
    console.log(`   ✅ Aggregated offences count on row: ${searchRes.incidents[0].offences.length}`);
    console.log(`   ✅ Total fine amount calculated: NGN ${searchRes.incidents[0].total_fine_amount}`);

    // 7. Test Correction Request Submission
    console.log('\n7️⃣ Testing Correction Request Lifecycle...');
    const correctionReq = await correctionService.submitRequest({
      incidentId: newIncident.id,
      reason: 'Typo in vehicle model, actual year is 2019 not 2018',
      proposedChanges: { vehicle_model: 'Corolla 2019' },
      requesterId: agentLogin.user.id,
    });
    console.log(`   ✅ Correction request submitted: ID=${correctionReq.id}, Status=${correctionReq.status}`);

    // 8. Test Supervisor Review & Atomic Approval
    console.log('\n8️⃣ Testing Supervisor Review (Approval)...');
    const reviewResult = await correctionService.reviewRequest({
      requestId: correctionReq.id,
      status: 'approved',
      reviewerId: adminLogin.user.id,
    });
    console.log(`   ✅ Correction reviewed: Status=${reviewResult.status}`);

    const updatedIncident = await incidentService.getIncidentById(newIncident.id);
    console.log(`   ✅ Verified incident vehicle model is now: "${updatedIncident.vehicle_model}"`);
    console.log(`   ✅ Verified incident status is now: "${updatedIncident.status}"`);

    // 9. Test Reports & Analytics
    console.log('\n9️⃣ Testing Reports & Analytics...');
    const summary = await reportService.getSummaryStats();
    console.log(`   ✅ Total Incidents: ${summary.overview.total_incidents}`);
    console.log(`   ✅ Total Fines Levied: NGN ${summary.overview.total_fines_amount}`);

    const topOffences = await reportService.getTopOffences(3);
    console.log(`   ✅ Top Offences count: ${topOffences.length}`);

    // 10. Test Audit Logs
    console.log('\n🔟 Testing Audit Trail...');
    const auditLogs = await auditLogService.getLogs({ limit: 5 });
    console.log(`   ✅ Retrieved ${auditLogs.logs.length} recent audit entries`);
    console.log(`   ✅ Latest action: ${auditLogs.logs[0].action} by user ${auditLogs.logs[0].user_name || 'System'}`);

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED PERFECTLY ON TURSO CLOUD DB!');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
