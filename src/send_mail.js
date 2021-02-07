'use strict';

const path = require('path');
const nodemailer = require('nodemailer');
const settings = require('../config.json');

/*
 * Send mail to corresponding mail list
 * @param {String}, subject, represents mail's subject
 * @param {String}, html, uses html document to repensent mail content
 */
async function sendMail(to, subject, html) {
  let from = 'webgraphics@intel.com';

  // Create reusable transporter object
  let transporter = nodemailer.createTransport({
    host: 'ecsmtp.sh.intel.com',
    port: 25,
    secure: false,
    auth: false,
  });

  // Verify transporter is avaliable
  transporter.verify(error => {
    if (error)
      console.error('transporter error: ', error);
    else
      console.log('Email was sent!');
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: from,        // sender address
    to: to,            // list of receivers
    subject: subject,  // Subject line
    html: html,        // html body
  });
  return Promise.resolve();
}

module.exports = sendMail;
