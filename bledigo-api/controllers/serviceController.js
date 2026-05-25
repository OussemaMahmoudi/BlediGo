'use strict';

const { validationResult } = require('express-validator');
const Service              = require('../models/Service');
const Notification         = require('../models/Notification');
const { sendItemReceivedEmail, sendStatusUpdateEmail } = require('../utils/email');
const jwt    = require('jsonwebtoken');
const QRCode = require('qrcode');

// Helper: generate QR data URL for a service
async function generateQR(service) {
  try {
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url  = `${base}/services/${encodeURIComponent(service._id || service.id)}`;
    service.qrCode.url      = url;
    service.qrCode.imageUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  } catch (e) {
    console.warn('QR generation error:', e.message);
  }
}

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

    const service = new Service({ ...req.body, createdBy: req.user._id });
    await generateQR(service);
    await service.save();
    res.status(201).json({ success: true, message: 'Service créé avec QR code.', data: service });
  } catch (err) { next(err); }
};

// ── GET /api/services/:id/qr  (Public) ─────────────────
exports.getServiceQR = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id).select('name qrCode');
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });
    // Regenerate if missing
    if (!service.qrCode?.imageUrl) {
      await generateQR(service);
      await service.save();
    }
    res.json({ success: true, data: { qrUrl: service.qrCode.url, qrImage: service.qrCode.imageUrl, name: service.name } });
  } catch (err) { next(err); }
};

// ── GET /api/services/my-demands  (Citoyen) ─────────────
exports.getMyDemands = async (req, res, next) => {
  try {
    const services = await Service.find({ 'demands.citizen': req.user._id })
      .select('name category demands qrCode.imageUrl stats');
    const demands = [];
    services.forEach(svc => {
      (svc.demands || []).forEach(d => {
        if (String(d.citizen) === String(req.user._id)) {
          demands.push({
            ...d.toObject(),
            serviceId:    svc._id,
            serviceName:  svc.name,
            serviceCategory: svc.category,
            avgRating:    svc.stats?.avgRating,
            userRating:   (d.evaluation?.score >= 1) ? d.evaluation.score : null,
            rated:        (d.evaluation?.score >= 1),
          });
        }
      });
    });
    demands.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: demands });
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

    // Prevent duplicate pending demand
    const alreadyPending = (service.demands || []).some(
      d => String(d.citizen) === String(req.user._id) && d.status === 'Pending'
    );
    if (alreadyPending) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà une demande en attente pour ce service.' });
    }

    service.demands.push({
      citizen:       req.user._id,
      notes:         req.body.notes,
      requestedDate: req.body.requestedDate,
    });
    service.stats.totalDemands++;
    await service.save();

    const newDemand = service.demands[service.demands.length - 1];

    // BF8: confirmation email with 2h cancel link
    const cancelToken = jwt.sign(
      { id: service._id, demandId: String(newDemand._id), type: 'service' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '2h' }
    );
    try {
      await sendItemReceivedEmail(req.user.email, req.user.firstName, 'Demande', service.name, cancelToken);
    } catch (emailErr) {
      console.warn('Email error (non-blocking):', emailErr.message);
    }

    await Notification.notify({
      recipient: req.user._id,
      type:      'service_demand_submitted',
      title:     'Demande soumise ✓',
      message:   `Votre demande pour "${service.name}" a été enregistrée. Vous pouvez l'annuler dans les 24h.`,
      ref:       { model: 'Service', id: service._id },
    });

    res.status(201).json({ success: true, message: 'Demande soumise avec succès.', demandId: String(newDemand._id) });
  } catch (err) { next(err); }
};

// ── DELETE /api/services/:id/demand/:demandId  (Citoyen — 24h window) ─
exports.cancelMyDemand = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });

    const demand = service.demands.id(req.params.demandId);
    if (!demand) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    if (String(demand.citizen) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    if (demand.status !== 'Pending')
      return res.status(400).json({ success: false, message: `Impossible d'annuler une demande déjà traitée (${demand.status}).` });

    // BF10: 24h window check
    const hoursElapsed = (Date.now() - new Date(demand.createdAt)) / 3600000;
    if (hoursElapsed > 24)
      return res.status(400).json({ success: false, message: 'Le délai de 24h pour annuler est dépassé.' });

    demand.status     = 'Rejected'; // use Rejected as 'cancelled by user'
    demand.notes      = 'Annulée par le citoyen';
    demand.processedAt = new Date();
    await service.save();

    await Notification.notify({
      recipient: req.user._id,
      type:      'service_demand_rejected',
      title:     'Demande annulée',
      message:   `Votre demande pour "${service.name}" a bien été annulée.`,
      ref:       { model: 'Service', id: service._id },
    });

    res.json({ success: true, message: 'Demande annulée.' });
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
    if (demand.status !== 'Pending')
      return res.status(400).json({ success: false, message: 'Cette demande a déjà été traitée.' });

    demand.status      = status;
    demand.notes       = notes || demand.notes;
    demand.processedBy = req.user._id;
    demand.processedAt = new Date();

    if (status === 'Accepted') service.stats.acceptedDemands++;
    await service.save();

    // BF9: notify citizen
    await Notification.notify({
      recipient: demand.citizen,
      type:      status === 'Accepted' ? 'service_demand_accepted' : 'service_demand_rejected',
      title:     `Demande ${status === 'Accepted' ? 'acceptée ✓' : 'refusée ✗'}`,
      message:   `Votre demande pour "${service.name}" a été ${status === 'Accepted' ? 'acceptée' : 'refusée'}.${notes ? ' Motif : ' + notes : ''}`,
      ref:       { model: 'Service', id: service._id },
    });

    // BF8: send email to citizen
    try {
      const Citoyen = require('../models/Citoyen');
      const citoyen = await Citoyen.findById(demand.citizen).select('email firstName');
      if (citoyen?.email) {
        await sendStatusUpdateEmail(
          citoyen.email, citoyen.firstName, 'Demande', service.name,
          status === 'Accepted' ? 'In Progress' : 'Rejected', notes
        );
      }
    } catch (emailErr) {
      console.warn('Email error (non-blocking):', emailErr.message);
    }

    res.json({ success: true, message: `Demande ${status === 'Accepted' ? 'acceptée' : 'refusée'} avec succès.` });
  } catch (err) { next(err); }
};

// ── PATCH /api/services/:id/demand/:demandId/reassign  (Admin only) ─
exports.reassignDemand = async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });

    const demand = service.demands.id(req.params.demandId);
    if (!demand) return res.status(404).json({ success: false, message: 'Demande introuvable.' });

    demand.processedBy = agentId;
    await service.save();

    res.json({ success: true, message: 'Demande réaffectée.' });
  } catch (err) { next(err); }
};

// ── POST /api/services/:id/rate  (Citoyen) ─────────────
exports.rateService = async (req, res, next) => {
  try {
    const { score, comment, demandId } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Note invalide (1-5).' });
    }
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });

    if (demandId) {
      const demand = service.demands.id(demandId);
      if (demand) {
        demand.evaluation = { score, comment };
      }
    }

    service.ratings.push({ citizen: req.user._id, score, comment });
    const total = service.ratings.reduce((s, r) => s + r.score, 0);
    service.stats.avgRating   = parseFloat((total / service.ratings.length).toFixed(2));
    service.stats.ratingCount = service.ratings.length;
    await service.save();

    res.json({ success: true, message: 'Note enregistrée.', avgRating: service.stats.avgRating });
  } catch (err) { next(err); }
};

// ───────────────────────────────────────────────────────
// GET /api/services/cancel-via-email
// Cancel service demand via email link (with JWT token)
// ───────────────────────────────────────────────────────
exports.cancelViaEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('<h1>Lien invalide ou expiré</h1>');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(400).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Ce lien d\'annulation a expiré (limite de 2 heures dépassée).</h1>');
      }
      return res.status(400).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Lien invalide ou altéré.</h1>');
    }

    if (decoded.type !== 'service' || !decoded.demandId) {
      return res.status(400).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Type de demande incorrect.</h1>');
    }

    const service = await Service.findById(decoded.id);
    if (!service) return res.status(404).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Service introuvable.</h1>');

    const demand = service.demands.id(decoded.demandId);
    if (!demand) return res.status(404).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Demande introuvable.</h1>');

    if (demand.status !== 'Pending') {
      return res.send(`
        <div style="font-family: Arial, sans-serif; text-align: center; max-width: 500px; margin: 40px auto; color: #333; padding: 30px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #F1AC4D; margin-bottom: 20px;">Impossible d'annuler</h1>
          <p style="font-size: 16px;">Cette demande a déjà été traitée (Statut : ${demand.status}).</p>
        </div>
      `);
    }

    demand.status = 'Cancelled';
    demand.processedAt = new Date();
    demand.notes = 'Annulée par le citoyen (via email)';
    
    await service.save();

    res.send(`
      <div style="font-family: Arial, sans-serif; text-align: center; max-width: 500px; margin: 40px auto; color: #333; padding: 30px; border: 1px solid #eee; border-radius: 10px; background-color: #F8FFF9; border-color: #D4EDDA;">
        <h1 style="color: #1D8C5E; margin-bottom: 20px;">Annulation confirmée</h1>
        <p style="font-size: 16px;">Votre demande a bien été annulée.</p>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">Vous pouvez fermer cette fenêtre.</p>
      </div>
    `);

  } catch (err) {
    next(err);
  }
};
