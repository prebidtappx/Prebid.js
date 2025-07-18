import {deepAccess, getBidIdParameter, isFn, logError, isArray, parseSizesInput, isPlainObject} from '../../src/utils.js';
import {getAdUnitSizes} from '../sizeUtils/sizeUtils.js';

export function getBidFloor(bid, currency = 'USD') {
  if (!isFn(bid.getFloor)) {
    return null;
  }

  const floor = bid.getFloor({
    currency,
    mediaType: '*',
    size: '*'
  });

  if (isPlainObject(floor) && !isNaN(floor.floor) && floor.currency === currency) {
    return floor.floor;
  }

  return null;
}

export function isBidRequestValid(bid, requiredParams = ['pid', 'env']) {
  if (bid && typeof bid.params !== 'object') {
    logError('Params is not defined or is incorrect in the bidder settings');
    return false;
  }

  for (const param of requiredParams) {
    if (!getBidIdParameter(param, bid.params)) {
      logError(`Required param "${param}" is missing in bidder params`);
      return false;
    }
  }

  if (deepAccess(bid, 'mediaTypes.video') && !isArray(deepAccess(bid, 'mediaTypes.video.playerSize'))) {
    logError('mediaTypes.video.playerSize is required for video');
    return false;
  }

  return true;
}

export function buildRequests(validBidRequests, bidderRequest, endpoint) {
  const {refererInfo = {}, gdprConsent = {}, uspConsent} = bidderRequest;
  const requests = validBidRequests.map(req => {
    const request = {};
    request.tmax = bidderRequest.timeout || 0;
    request.bidId = req.bidId;
    request.banner = deepAccess(req, 'mediaTypes.banner');
    request.auctionId = req.ortb2?.source?.tid;
    request.transactionId = req.ortb2Imp?.ext?.tid;
    request.sizes = parseSizesInput(getAdUnitSizes(req));
    request.schain = bidderRequest?.ortb2?.source?.ext?.schain;
    request.location = {
      page: refererInfo.page,
      location: refererInfo.location,
      domain: refererInfo.domain,
      whost: window.location.host,
      ref: refererInfo.ref,
      isAmp: refererInfo.isAmp
    };
    request.device = {
      ua: navigator.userAgent,
      lang: navigator.language
    };
    request.env = {
      env: req.params.env,
      pid: req.params.pid
    };
    request.ortb2 = req.ortb2;
    request.ortb2Imp = req.ortb2Imp;
    request.tz = new Date().getTimezoneOffset();
    request.ext = req.params.ext;
    request.bc = req.bidRequestsCount;
    request.floor = getBidFloor(req);

    if (req.userIdAsEids && req.userIdAsEids.length !== 0) {
      request.userEids = req.userIdAsEids;
    } else {
      request.userEids = [];
    }

    request.gdprConsent = gdprConsent;

    if (uspConsent) {
      request.usPrivacy = uspConsent;
    } else {
      request.usPrivacy = '';
    }
    const video = deepAccess(req, 'mediaTypes.video');
    if (video) {
      request.sizes = parseSizesInput(deepAccess(req, 'mediaTypes.video.playerSize'));
      request.video = video;
    }

    return request;
  });

  return {
    method: 'POST',
    url: endpoint + '/bid',
    data: JSON.stringify(requests),
    withCredentials: true,
    bidderRequest,
    options: {
      contentType: 'application/json',
    }
  };
}

export function interpretResponse(serverResponse, {bidderRequest}) {
  const response = [];
  if (!isArray(deepAccess(serverResponse, 'body.data'))) {
    return response;
  }

  serverResponse.body.data.forEach(serverBid => {
    const bidIndex = Array.isArray(bidderRequest.bids)
      ? bidderRequest.bids.findIndex(bidRequest => bidRequest.bidId === serverBid.requestId)
      : undefined;

    if (bidIndex !== -1) {
      const bid = {
        requestId: serverBid.requestId,
        dealId: bidderRequest.dealId || null,
        ...serverBid
      };
      response.push(bid);
    }
  });

  return response;
}

export function getUserSyncs(syncOptions, serverResponses, gdprConsent = {}, uspConsent = '') {
  const syncs = [];
  const pixels = deepAccess(serverResponses, '0.body.data.0.ext.pixels');

  if ((syncOptions.iframeEnabled || syncOptions.pixelEnabled) && isArray(pixels) && pixels.length !== 0) {
    const gdprFlag = `&gdpr=${gdprConsent.gdprApplies ? 1 : 0}`;
    const gdprString = `&gdpr_consent=${encodeURIComponent((gdprConsent.consentString || ''))}`;
    const usPrivacy = `us_privacy=${encodeURIComponent(uspConsent)}`;

    pixels.forEach(pixel => {
      const [type, url] = pixel;
      const sync = {type, url: `${url}&${usPrivacy}${gdprFlag}${gdprString}`};
      if (type === 'iframe' && syncOptions.iframeEnabled) {
        syncs.push(sync)
      } else if (type === 'image' && syncOptions.pixelEnabled) {
        syncs.push(sync)
      }
    });
  }

  return syncs;
}
