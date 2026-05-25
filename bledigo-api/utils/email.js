const nodemailer = require('nodemailer');

// Reuse module-level transporter for performance connection pooling
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP variables missing in .env. Falling back to log-only emailer in development.');
    }
    
    // Default config using environment variables
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    transporter = nodemailer.createTransport(config);
  }
  return transporter;
};

exports.sendVerificationEmail = async (toEmail, code, firstName) => {
  // If SMTP is not configured properly, just log it out and pretend it succeeded. 
  // This helps in DEV if the user hasn't gotten their App Password yet.
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n======================================================');
    console.log('✉️ MOCK EMAIL SENT');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: Votre code de vérification BlediGo`);
    console.log(`Code: ${code}`);
    console.log('======================================================\n');
    return true;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; text-align: center; max-width: 500px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h1 style="color: #1A3C6B; margin-bottom: 5px;">BlediGo</h1>
      <p style="font-size: 14px; color: #888; margin-top: 0;">Plateforme Municipale</p>
      
      <h2 style="font-size: 20px; margin-top: 30px;">Bonjour ${firstName || 'Citoyen'},</h2>
      <p style="font-size: 16px;">Veuillez utiliser le code ci-dessous pour vérifier votre adresse email et finaliser la création de votre compte.</p>
      
      <div style="margin: 30px 0; padding: 15px; background-color: #EEF3FB; font-size: 32px; font-weight: bold; color: #1A3C6B; border-radius: 8px; letter-spacing: 5px;">
        ${code}
      </div>
      
      <p style="font-size: 13px; color: #999;">Ce code expirera dans 10 minutes.</p>
      <p style="font-size: 13px; color: #999;">Si vous n'avez pas demandé la création de ce compte, veuillez ignorer cet email.</p>
    </div>
  `;

  const mailOptions = {
    from: `"BlediGo" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Votre code de vérification BlediGo : ${code}`,
    html: htmlContent,
  };

  try {
    const t = getTransporter();
    await t.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Email sending failed:', err);
    throw new Error('Erreur lors de l\'envoi de l\'email.');
  }
};

exports.sendPasswordResetEmail = async (toEmail, code, firstName) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n======================================================');
    console.log('✉️ MOCK PASSWORD RESET EMAIL SENT');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: Réinitialisation de votre mot de passe BlediGo`);
    console.log(`Code: ${code}`);
    console.log('======================================================\n');
    return true;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; text-align: center; max-width: 500px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h1 style="color: #1A3C6B; margin-bottom: 5px;">BlediGo</h1>
      <p style="font-size: 14px; color: #888; margin-top: 0;">Plateforme Municipale</p>
      
      <h2 style="font-size: 20px; margin-top: 30px;">Bonjour ${firstName || 'Utilisateur'},</h2>
      <p style="font-size: 16px;">Vous avez demandé la réinitialisation de votre mot de passe. Veuillez utiliser ce code pour continuer :</p>
      
      <div style="margin: 30px 0; padding: 15px; background-color: #EEF3FB; font-size: 32px; font-weight: bold; color: #1A3C6B; border-radius: 8px; letter-spacing: 5px;">
        ${code}
      </div>
      
      <p style="font-size: 13px; color: #999;">Ce code expirera dans 10 minutes.</p>
      <p style="font-size: 13px; color: #999;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>
    </div>
  `;

  const mailOptions = {
    from: `"BlediGo" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Réinitialisation de votre mot de passe BlediGo : ${code}`,
    html: htmlContent,
  };

  try {
    const t = getTransporter();
    await t.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Email sending failed:', err);
    throw new Error('Erreur lors de l\'envoi de l\'email.');
  }
};

exports.sendItemReceivedEmail = async (toEmail, firstName, itemType, itemTitle, cancelToken) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n======================================================');
    console.log('✉️ MOCK RECEIVED EMAIL SENT');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: Confirmation de réception - ${itemType}`);
    console.log(`Title: ${itemTitle} | Token: ${cancelToken ? 'YES' : 'NO'}`);
    console.log('======================================================\n');
    return true;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const itemRoute   = itemType === 'Réclamation' ? 'reclamation' : 'service'
  const cancelUrl   = cancelToken
    ? `${frontendUrl}/cancel?token=${cancelToken}&type=${itemRoute}`
    : ''

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h1 style="color: #1A3C6B; margin-bottom: 5px; text-align: center;">BlediGo</h1>
      <p style="font-size: 14px; color: #888; margin-top: 0; text-align: center;">Plateforme Municipale</p>
      
      <h2 style="font-size: 18px; margin-top: 30px;">Bonjour ${firstName || 'Citoyen'},</h2>
      <p style="font-size: 15px; line-height: 1.5;">Nous vous confirmons la bonne réception de votre ${itemType.toLowerCase()} intitulée :</p>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #1A3C6B; font-weight: bold; font-size: 15px;">
        ${itemTitle}
      </div>
      
      <p style="font-size: 15px; line-height: 1.5;">Nos agents vont traiter votre demande dans les plus brefs délais.</p>
      
      ${cancelUrl ? `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc; text-align: center;">
        <p style="font-size: 13px; color: #555; margin-bottom: 15px;">Si vous avez fait une erreur, vous pouvez annuler cette soumission (valable pendant 2 heures).</p>
        <a href="${cancelUrl}" style="background-color: #E24B4A; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold; font-size: 14px; display: inline-block;">Annuler la soumission</a>
      </div>
      ` : ''}
    </div>
  `;

  try {
    const t = getTransporter();
    await t.sendMail({
      from: `"BlediGo" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Confirmation de réception de votre ${itemType.toLowerCase()}`,
      html: htmlContent,
    });
    return true;
  } catch (err) {
    console.error('Email sending failed:', err);
  }
};

exports.sendStatusUpdateEmail = async (toEmail, firstName, itemType, itemTitle, newStatus, motif) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { return true; }

  const statusLabel = 
    newStatus === 'Resolved' ? 'Résolue / Confirmée' :
    newStatus === 'Rejected' ? 'Refusée' :
    newStatus === 'Cancelled' ? 'Annulée' :
    newStatus === 'In Progress' ? 'En cours de traitement' : newStatus;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h1 style="color: #1A3C6B; margin-bottom: 5px; text-align: center;">BlediGo</h1>
      
      <h2 style="font-size: 18px; margin-top: 30px;">Bonjour ${firstName || 'Citoyen'},</h2>
      <p style="font-size: 15px; line-height: 1.5;">Le statut de votre ${itemType.toLowerCase()} a été mis à jour.</p>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #F1AC4D; font-weight: bold; font-size: 15px;">
        ${itemTitle}
      </div>
      
      <p style="font-size: 15px;">Nouveau statut : <span style="font-weight:bold; color:#1D8C5E;">${statusLabel}</span></p>
      
      ${motif ? `
      <div style="margin-top: 15px; padding: 12px; background-color: #FFF3CD; color: #856404; border-radius: 5px; font-size: 14px;">
        <strong>Message de l'agent :</strong> ${motif}
      </div>` : ''}
    </div>
  `;

  try {
    const t = getTransporter();
    await t.sendMail({
      from: `"BlediGo" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Mise à jour de votre ${itemType.toLowerCase()} - ${statusLabel}`,
      html: htmlContent,
    });
    return true;
  } catch (err) {
    console.error('Email sending failed:', err);
  }
};

exports.sendAgentAssignmentEmail = async (agentEmail, agentName, itemTitle, itemUrgency) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { return true; }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h1 style="color: #1A3C6B; margin-bottom: 5px; text-align: center;">BlediGo - Nouvelle Affectation</h1>
      
      <h2 style="font-size: 18px; margin-top: 30px;">Bonjour ${agentName},</h2>
      <p style="font-size: 15px; line-height: 1.5;">Une nouvelle réclamation vous a été assignée.</p>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #1D8C5E; font-weight: bold; font-size: 15px;">
        ${itemTitle}
      </div>
      
      <p style="font-size: 15px;">Urgence : <span style="font-weight:bold; color:#E24B4A;">${itemUrgency}</span></p>
      <p style="font-size: 15px;">Veuillez consulter votre tableau de bord pour la traiter dans les meilleurs délais.</p>
    </div>
  `;

  try {
    const t = getTransporter();
    await t.sendMail({
      from: `"BlediGo" <${process.env.SMTP_USER}>`,
      to: agentEmail,
      subject: `Affectation d'une nouvelle réclamation`,
      html: htmlContent,
    });
    return true;
  } catch (err) {
    console.error('Email sending failed:', err);
  }
};
