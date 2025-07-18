import { expect } from 'chai';
import { adpodUtils } from 'modules/freeWheelAdserverVideo.js';
import { auctionManager } from 'src/auctionManager.js';
import { config } from 'src/config.js';
import { server } from 'test/mocks/xhr.js';

describe('freeWheel adserver module', function() {
  let amStub;
  let amGetAdUnitsStub;

  before(function () {
    const adUnits = [{
      code: 'preroll_1',
      mediaTypes: {
        video: {
          context: 'adpod',
          playerSize: [640, 480],
          adPodDurationSec: 60,
          durationRangeSec: [15, 30],
          requireExactDuration: true
        }
      },
      bids: [
        {
          bidder: 'appnexus',
          params: {
            placementId: 14542875,
          }
        }
      ]
    }, {
      code: 'midroll_1',
      mediaTypes: {
        video: {
          context: 'adpod',
          playerSize: [640, 480],
          adPodDurationSec: 60,
          durationRangeSec: [15, 30],
          requireExactDuration: true
        }
      },
      bids: [
        {
          bidder: 'appnexus',
          params: {
            placementId: 14542875,
          }
        }
      ]
    }];

    amGetAdUnitsStub = sinon.stub(auctionManager, 'getAdUnits');
    amGetAdUnitsStub.returns(adUnits);
    amStub = sinon.stub(auctionManager, 'getBidsReceived');
  });

  beforeEach(function () {
    config.setConfig({
      adpod: {
        brandCategoryExclusion: false,
        deferCaching: false
      }
    });
  })

  afterEach(function() {
    config.resetConfig();
  });

  after(function () {
    amGetAdUnitsStub.restore();
    amStub.restore();
  });

  it('should return targeting for all adunits', function() {
    amStub.returns(getBidsReceived());
    let targeting;
    adpodUtils.getTargeting({
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    expect(targeting['preroll_1'].length).to.equal(3);
    expect(targeting['midroll_1'].length).to.equal(3);
  });

  it('should return targeting for passed adunit code', function() {
    amStub.returns(getBidsReceived());
    let targeting;
    adpodUtils.getTargeting({
      codes: ['preroll_1'],
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    expect(targeting['preroll_1']).to.exist;
    expect(targeting['midroll_1']).to.not.exist;
  });

  it('should only use adpod bids', function() {
    const bannerBid = [{
      'ad': 'creative',
      'cpm': '1.99',
      'width': 300,
      'height': 250,
      'requestId': '1',
      'creativeId': 'some-id',
      'currency': 'USD',
      'netRevenue': true,
      'ttl': 360,
      'bidderCode': 'appnexus',
      'statusMessage': 'Bid available',
      'adId': '28f24ced14586c',
      'adUnitCode': 'preroll_1'
    }];
    amStub.returns(getBidsReceived().concat(bannerBid));
    let targeting;
    adpodUtils.getTargeting({
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    expect(targeting['preroll_1'].length).to.equal(3);
    expect(targeting['midroll_1'].length).to.equal(3);
  });

  it('should return unique category bids when competitive exclusion is enabled', function() {
    config.setConfig({
      adpod: {
        brandCategoryExclusion: true,
        deferCaching: false
      }
    });
    amStub.returns([
      createBid(10, 'preroll_1', 30, '10.00_395_30s', '123', '395'),
      createBid(15, 'preroll_1', 30, '15.00_395_30s', '123', '395'),
      createBid(15, 'midroll_1', 60, '15.00_406_60s', '123', '406'),
      createBid(10, 'preroll_1', 30, '10.00_395_30s', '123', '395')
    ]);
    let targeting;
    adpodUtils.getTargeting({
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    expect(targeting['preroll_1'].length).to.equal(3);
    expect(targeting['midroll_1'].length).to.equal(2);
  });

  it('should only select bids less than adpod duration', function() {
    amStub.returns([
      createBid(10, 'preroll_1', 90, '10.00_395_90s', '123', '395'),
      createBid(15, 'preroll_1', 90, '15.00_395_90s', '123', '395'),
      createBid(15, 'midroll_1', 90, '15.00_406_90s', '123', '406')
    ]);
    let targeting;
    adpodUtils.getTargeting({
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    expect(targeting['preroll_1']).to.be.empty;
    expect(targeting['midroll_1']).to.be.empty;
  });

  it('should select bids when deferCaching is enabled', function() {
    config.setConfig({
      adpod: {
        deferCaching: true
      }
    });
    amStub.returns(getBidsReceived());
    let targeting;
    adpodUtils.getTargeting({
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    server.requests[0].respond(
      200,
      { 'Content-Type': 'text/plain' },
      JSON.stringify({'responses': getBidsReceived().slice(0, 4)})
    );

    expect(targeting['preroll_1'].length).to.equal(3);
    expect(targeting['midroll_1'].length).to.equal(3);
  });

  it('should prioritize bids with deal', function() {
    config.setConfig({
      adpod: {
        deferCaching: true,
        prioritizeDeals: true
      }
    });

    const tier6Bid = createBid(10, 'preroll_1', 15, 'tier6_395_15s', '123', '395');
    tier6Bid['video']['dealTier'] = 'tier6'

    const tier7Bid = createBid(11, 'preroll_1', 45, 'tier7_395_15s', '123', '395');
    tier7Bid['video']['dealTier'] = 'tier7'

    const bidsReceived = [
      tier6Bid,
      tier7Bid,
      createBid(15, 'preroll_1', 90, '15.00_395_90s', '123', '395'),
    ]
    amStub.returns(bidsReceived);
    let targeting;
    adpodUtils.getTargeting({
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    server.requests[0].respond(
      200,
      { 'Content-Type': 'text/plain' },
      JSON.stringify({'responses': bidsReceived.slice(1)})
    );

    expect(targeting['preroll_1'].length).to.equal(3);
    expect(targeting['preroll_1']).to.deep.include({'hb_pb_cat_dur': 'tier6_395_15s'});
    expect(targeting['preroll_1']).to.deep.include({'hb_pb_cat_dur': 'tier7_395_15s'});
    expect(targeting['preroll_1']).to.deep.include({'hb_cache_id': '123'});
  });

  it('should apply minDealTier to bids if configured', function() {
    config.setConfig({
      adpod: {
        deferCaching: true,
        prioritizeDeals: true,
        dealTier: {
          'appnexus': {
            prefix: 'tier',
            minDealTier: 5
          }
        }
      }
    });

    const tier2Bid = createBid(10, 'preroll_1', 15, 'tier2_395_15s', '123', '395');
    tier2Bid['video']['dealTier'] = 2
    tier2Bid['adserverTargeting']['hb_pb'] = '10.00'

    const tier7Bid = createBid(11, 'preroll_1', 45, 'tier7_395_15s', '123', '395');
    tier7Bid['video']['dealTier'] = 7
    tier7Bid['adserverTargeting']['hb_pb'] = '11.00'

    const bid = createBid(15, 'preroll_1', 15, '15.00_395_90s', '123', '395');
    bid['adserverTargeting']['hb_pb'] = '15.00'

    const bidsReceived = [
      tier2Bid,
      tier7Bid,
      bid
    ]
    amStub.returns(bidsReceived);
    let targeting;
    adpodUtils.getTargeting({
      callback: function(errorMsg, targetingResult) {
        targeting = targetingResult;
      }
    });

    server.requests[0].respond(
      200,
      { 'Content-Type': 'text/plain' },
      JSON.stringify({'responses': [tier7Bid, bid]})
    );

    expect(targeting['preroll_1'].length).to.equal(3);
    expect(targeting['preroll_1']).to.deep.include({'hb_pb_cat_dur': 'tier7_395_15s'});
    expect(targeting['preroll_1']).to.deep.include({'hb_pb_cat_dur': '15.00_395_90s'});
    expect(targeting['preroll_1']).to.not.include({'hb_pb_cat_dur': 'tier2_395_15s'});
    expect(targeting['preroll_1']).to.deep.include({'hb_cache_id': '123'});
  })
});

function getBidsReceived() {
  return [
    createBid(10, 'preroll_1', 15, '10.00_395_15s', '123', '395'),
    createBid(15, 'preroll_1', 15, '15.00_395_15s', '123', '395'),
    createBid(15, 'midroll_1', 30, '15.00_406_30s', '123', '406'),
    createBid(5, 'midroll_1', 5, '5.00_406_5s', '123', '406'),
    createBid(20, 'midroll_1', 60, '20.00_406_60s', '123', '406'),
  ]
}

function createBid(cpm, adUnitCode, durationBucket, priceIndustryDuration, uuid, industry) {
  return {
    'bidderCode': 'appnexus',
    'width': 640,
    'height': 360,
    'statusMessage': 'Bid available',
    'adId': '28f24ced14586c',
    'mediaType': 'video',
    'source': 'client',
    'requestId': '28f24ced14586c',
    'cpm': cpm,
    'creativeId': 97517771,
    'currency': 'USD',
    'netRevenue': true,
    'ttl': 3600,
    'adUnitCode': adUnitCode,
    'video': {
      'context': 'adpod',
      'durationBucket': durationBucket
    },
    'appnexus': {
      'buyerMemberId': 9325
    },
    'vastUrl': 'http://some-vast-url.com',
    'vastImpUrl': 'http://some-vast-imp-url.com',
    'auctionId': 'ec266b31-d652-49c5-8295-e83fafe5532b',
    'responseTimestamp': 1548442460888,
    'requestTimestamp': 1548442460827,
    'bidder': 'appnexus',
    'timeToRespond': 61,
    'pbLg': '5.00',
    'pbMg': '5.00',
    'pbHg': '5.00',
    'pbAg': '5.00',
    'pbDg': '5.00',
    'pbCg': '',
    'size': '640x360',
    'adserverTargeting': {
      'hb_bidder': 'appnexus',
      'hb_adid': '28f24ced14586c',
      'hb_pb': '5.00',
      'hb_size': '640x360',
      'hb_source': 'client',
      'hb_format': 'video',
      'hb_pb_cat_dur': priceIndustryDuration,
      'hb_cache_id': uuid
    },
    'customCacheKey': `${priceIndustryDuration}_${uuid}`,
    'meta': {
      'primaryCatId': 'iab-1',
      'adServerCatId': industry
    },
    'videoCacheKey': '4cf395af-8fee-4960-af0e-88d44e399f14'
  }
}
