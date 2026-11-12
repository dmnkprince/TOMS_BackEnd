import { pool } from '../config/db.js';

export const vehicleLookupService = {
  /**
   * Retrieves the most recently recorded vehicle snapshot from previous incidents.
   * Does NOT alter historical records.
   * @param {string} plateNumber Vehicle registration plate number
   */
  async lookupByPlate(plateNumber) {
    const formattedPlate = plateNumber.trim().toUpperCase();

    // 1. Get total historical encounter count
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM incidents WHERE UPPER(plate_number) = $1`,
      [formattedPlate]
    );
    const totalPriorIncidents = parseInt(countRes.rows[0].total, 10);

    if (totalPriorIncidents === 0) {
      return {
        found: false,
        plate_number: formattedPlate,
        message: 'No previous vehicle encounters found on record.',
        vehicle: null,
        total_prior_incidents: 0,
      };
    }

    // 2. Fetch latest snapshot
    const latestQuery = `
      SELECT 
        plate_number,
        body_number,
        vehicle_make,
        vehicle_model,
        vehicle_color,
        vehicle_type,
        vehicle_owner_name,
        vehicle_owner_phone,
        driver_license_number,
        driver_name,
        incident_date AS last_incident_date,
        reference_number AS last_incident_reference
      FROM incidents
      WHERE UPPER(plate_number) = $1
      ORDER BY incident_date DESC
      LIMIT 1
    `;
    const result = await pool.query(latestQuery, [formattedPlate]);
    const latestVehicle = result.rows[0];

    return {
      found: true,
      plate_number: formattedPlate,
      message: 'Previous vehicle snapshot retrieved successfully.',
      vehicle: latestVehicle,
      total_prior_incidents: totalPriorIncidents,
    };
  },
};
