// src/models/incidentReport.js
import mongoose from 'mongoose';

const IncidentReportSchema = new mongoose.Schema(
  {
    plateNumber: { type: String, required: true },
    motNumber: { type: String },
    vehicleType: { type: String },
    makeModel: { type: String },
    color: { type: String },
    time: { type: String }, // store as HH:mm or similar string
    date: { type: Date },
    offenceType: { type: String },
    location: { type: String },
    description: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('IncidentReport', IncidentReportSchema);
