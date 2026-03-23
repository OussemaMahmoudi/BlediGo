'use strict';

const { validationResult } = require('express-validator');
const Service              = require('../models/Service');
const Notification         = require('../models/Notification');

// ── GET /api/services  ──────────────────────────────────
exports.getAllServices = async (req, res, next) => {
  try {
    const { category, isActive, mode, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category !== undefined) filter.category = category;
    if (isActive  !== undefined) filter.isActive = isActive === 'true';
    if (mode      !== undefined) filter.mode     = mode;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [services, total] = await Promise.all([
      Service.find(filter)
        .populate('responsibleAgent', 'firstName lastName department')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-ratings'),
      Service.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { services, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } },
    });
  } catch (err) { next(err); }
};

// ── GET /api/services/:id  ──────────────────────────────
exports.getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('responsibleAgent', 'firstName lastName department phone');
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });
    res.json({ success: true, data: service });
  } catch (err) { next(err); }
};

// ── POST /api/services  (Admin) ─────────────────────────
exports.createService = async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(422).json({ success: false, errors: errs.array() });

    const service = await Service.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, message: 'Service créé.', data: service });
  } catch (err) { next(err); }
};

// ── PATCH /api/services/:id  (Admin) ───────────────────
exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });
    res.json({ success: true, message: 'Service mis à jour.', data: service });
  } catch (err) { next(err); }
};

// ── DELETE /api/services/:id  (Admin) ──────────────────
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });
    res.json({ success: true, message: 'Service supprimé.' });
  } catch (err) { next(err); }
};

// ── POST /api/services/:id/demand  (Citoyen) ───────────
exports.submitDemand = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });
    if (!service.isActive) return res.status(400).json({ success: false, message: 'Service indisponible.' });

    service.demands.push({
      citizen:       req.user._id,
      notes:         req.body.notes,
      requestedDate: req.body.requestedDate,
    });
    service.stats.totalDemands++;
    await service.save();

    await Notification.notify({
      recipient: req.user._id,
      type:      'service_demand_accepted',
      title:     'Demande soumise',
      message:   `Votre demande pour le service "${service.name}" a été enregistrée.`,
      ref:       { model: 'Service', id: service._id },
    });

    res.status(201).json({ success: true, message: 'Demande soumise avec succès.' });
  } catch (err) { next(err); }
};

// ── PATCH /api/services/:id/demand/:demandId  (Agent/Admin) ─
exports.processDemand = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!['Accepted','Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Statut invalide. 'Accepted' ou 'Rejected'." });
    }

    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });

    const demand = service.demands.id(req.params.demandId);
    if (!demand) return res.status(404).json({ success: false, message: 'Demande introuvable.' });

    demand.status      = status;
    demand.notes       = notes || demand.notes;
    demand.processedBy = req.user._id;
    demand.processedAt = new Date();

    if (status === 'Accepted') service.stats.acceptedDemands++;
    await service.save();

    await Notification.notify({
      recipient: demand.citizen,
      type:      status === 'Accepted' ? 'service_demand_accepted' : 'service_demand_rejected',
      title:     `Demande ${status === 'Accepted' ? 'acceptée' : 'refusée'}`,
      message:   `Votre demande pour "${service.name}" a été ${status === 'Accepted' ? 'acceptée' : 'refusée'}.${notes ? ' ' + notes : ''}`,
      ref:       { model: 'Service', id: service._id },
    });

    res.json({ success: true, message: `Demande ${status}.` });
  } catch (err) { next(err); }
};

// ── POST /api/services/:id/rate  (Citoyen) ─────────────
exports.rateService = async (req, res, next) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Note invalide (1-5).' });
    }
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });

    service.ratings.push({ citizen: req.user._id, score, comment });
    const total = service.ratings.reduce((s, r) => s + r.score, 0);
    service.stats.avgRating   = parseFloat((total / service.ratings.length).toFixed(2));
    service.stats.ratingCount = service.ratings.length;
    await service.save();

    res.json({ success: true, message: 'Note enregistrée.', avgRating: service.stats.avgRating });
  } catch (err) { next(err); }
};
