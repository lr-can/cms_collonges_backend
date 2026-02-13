const express = require('express');
const router5 = express.Router();
const notif = require('../services/interventionNotif');

/* POST smartemis response. */
router5.post('/', async function(req, res, next) {
  try {
    const startTime = Date.now();
    const body = req.body || {};
    const bodySummary = {
      keys: Object.keys(body),
      itvDetail: Boolean(body.itvDetail),
      depItvCsListLen: body.itvDetail && Array.isArray(body.itvDetail.depItvCsList) ? body.itvDetail.depItvCsList.length : 0,
      histItvListLen: Array.isArray(body.histItvList) ? body.histItvList.length : 0,
      engListLen: Array.isArray(body.engList) ? body.engList.length : 0,
      localGlobalInstructionListLen: Array.isArray(body.localGlobalInstructionList) ? body.localGlobalInstructionList.length : 0,
      csPersListLen: Array.isArray(body.csPersList) ? body.csPersList.length : 0,
      notificationListLen: Array.isArray(body.notificationList) ? body.notificationList.length : 0,
      planningCounterListLen: Array.isArray(body.planningCounterList) ? body.planningCounterList.length : 0
    };
    console.log('[smartemis] request start', {
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      contentLength: req.headers['content-length'],
      bodySummary
    });
    const result = await notif.insertSmartemisResponse(req.body);
    console.log('[smartemis] request success', {
      requestId: req.headers['x-request-id'],
      durationMs: Date.now() - startTime,
      success: result && result.success,
      operations: result && Array.isArray(result.operations) ? result.operations.length : 0,
      errors: result && Array.isArray(result.errors) ? result.errors.length : 0
    });
    res.json(result);
  } catch (err) {
    console.error(`[smartemis] request error`, {
      requestId: req.headers['x-request-id'],
      error: err.message
    });
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
      errors: [err.message]
    });
  }
});

module.exports = router5;