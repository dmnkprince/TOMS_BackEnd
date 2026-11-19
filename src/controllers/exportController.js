import ExcelJS from 'exceljs';
import { ROLES } from '../constants/roles.js';
import { turso } from '../config/db.js';

export const exportController = {
  // Admin or Supervisor: Export traffic incident reports as Excel
  async exportIncidents(req, res, next) {
    try {
      const userRole = req.user?.role;
      if (!userRole || ![ROLES.ADMIN, ROLES.SUPERVISOR].includes(userRole)) {
        const err = new Error('Access denied: only admins or supervisors may export incident reports.');
        err.statusCode = 403;
        throw err;
      }

      const { startDate, endDate, start_date, end_date } = req.query;
      const fromDate = (startDate || start_date || '').trim();
      const toDate = (endDate || end_date || '').trim();

      const conditions = [];
      const args = [];

      if (fromDate) {
        conditions.push('DATE(i.incident_date) >= DATE(?)');
        args.push(fromDate);
      }
      if (toDate) {
        conditions.push('DATE(i.incident_date) <= DATE(?)');
        args.push(toDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query incidents from Turso (SQLite) with offence info
      const result = await turso.execute({
        sql: `
          SELECT 
            i.plate_number,
            i.body_number,
            i.vehicle_type,
            i.vehicle_make,
            i.vehicle_model,
            i.vehicle_color,
            i.incident_date,
            i.manual_location,
            i.remarks,
            GROUP_CONCAT(ot.title, ', ') AS offence_titles,
            GROUP_CONCAT(io.notes, ', ') AS offence_notes
          FROM incidents i
          LEFT JOIN incident_offences io ON i.id = io.incident_id
          LEFT JOIN offence_types ot ON io.offence_type_id = ot.id
          ${whereClause}
          GROUP BY i.id
          ORDER BY i.incident_date DESC
        `,
        args,
      });

      const incidents = result.rows;

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Incident Reports');

      // Define columns matching the required field names
      worksheet.columns = [
        { header: 'Plate Number', key: 'plateNumber', width: 20 },
        { header: 'MOT Number', key: 'motNumber', width: 20 },
        { header: 'Vehicle Type', key: 'vehicleType', width: 15 },
        { header: 'Make/Model', key: 'makeModel', width: 20 },
        { header: 'Color', key: 'color', width: 12 },
        { header: 'Time', key: 'time', width: 12 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Offence Type', key: 'offenceType', width: 25 },
        { header: 'Location', key: 'location', width: 25 },
        { header: 'Description / Notes', key: 'description', width: 35 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true };

      // Populate rows
      incidents.forEach((inc) => {
        // Parse date and time from incident_date
        let dateStr = '';
        let timeStr = '';
        if (inc.incident_date) {
          try {
            const dt = new Date(inc.incident_date);
            if (!isNaN(dt.getTime())) {
              dateStr = dt.toISOString().split('T')[0];
              timeStr = dt.toLocaleTimeString('en-GB');
            } else {
              // incident_date might be a plain string like "2026-11-12"
              dateStr = String(inc.incident_date).slice(0, 10);
            }
          } catch {
            dateStr = String(inc.incident_date).slice(0, 10);
          }
        }

        const make = inc.vehicle_make || '';
        const model = inc.vehicle_model || '';
        const makeModel = [make, model].filter(Boolean).join(' ') || '';

        worksheet.addRow({
          plateNumber: inc.plate_number || '',
          motNumber: inc.body_number || '',
          vehicleType: inc.vehicle_type || '',
          makeModel,
          color: inc.vehicle_color || '',
          time: timeStr,
          date: dateStr,
          offenceType: inc.offence_titles || inc.offence_notes || '',
          location: inc.manual_location || '',
          description: inc.remarks || '',
        });
      });

      // Write workbook to buffer
      const buffer = await workbook.xlsx.writeBuffer();

      let filename = 'incident_reports.xlsx';
      if (fromDate && toDate) {
        filename = `incident_reports_${fromDate}_to_${toDate}.xlsx`;
      } else if (fromDate) {
        filename = `incident_reports_from_${fromDate}.xlsx`;
      } else if (toDate) {
        filename = `incident_reports_to_${toDate}.xlsx`;
      }

      // Set headers for file download
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  },
};
