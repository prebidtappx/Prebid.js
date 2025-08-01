import {
  JWPlayerProvider,
  adStateFactory,
  timeStateFactory,
  callbackStorageFactory,
  utils
} from 'modules/jwplayerVideoProvider';

import {
  PROTOCOLS, API_FRAMEWORKS, VIDEO_MIME_TYPE, PLAYBACK_METHODS, PLACEMENT, VPAID_MIME_TYPE
} from 'libraries/video/constants/ortb.js';

import {
  SETUP_COMPLETE, SETUP_FAILED, PLAY, AD_IMPRESSION, AD_STARTED, SEEK_END, videoEvents
} from 'libraries/video/constants/events.js';

import { PLAYBACK_MODE } from 'libraries/video/constants/constants.js';

function getPlayerMock() {
  return makePlayerFactoryMock({
    getState: function () {},
    setup: function () { return this; },
    getViewable: function () {},
    getPercentViewable: function () {},
    getMute: function () {},
    getVolume: function () {},
    getConfig: function () {},
    getHeight: function () {},
    getContainer: function () {},
    getWidth: function () {},
    getFullscreen: function () {},
    getPlaylistItem: function () {},
    playAd: function () {},
    on: function () { return this; },
    off: function () { return this; },
    remove: function () {},
    getAudioTracks: function () {},
    getCurrentAudioTrack: function () {},
    getPlugin: function () {},
    getFloating: function () {}
  })();
}

function makePlayerFactoryMock(playerMock_) {
  const playerFactory = function () {
    return playerMock_;
  }
  playerFactory.version = '8.21.0';
  return playerFactory;
}

function getUtilsMock() {
  return {
    getJwConfig: function () {},
    getPlayerHeight: function () {},
    getPlayerWidth: function () {},
    getPlayerSizeFromAspectRatio: function () {},
    getSupportedMediaTypes: function () {},
    getStartDelay: function () {},
    getPlacement: function () {},
    getPlaybackMethod: function () {},
    isOmidSupported: function () {},
    getSkipParams: function () {},
    getJwEvent: event => event,
    getIsoLanguageCode: function () {},
    getSegments: function () {},
    getContentDatum: function () {}
  };
}

const sharedUtils = { videoEvents };

function addDiv() {
  const div = document.createElement('div');
  div.setAttribute('id', 'test');
  document.body.appendChild(div);
}

function removeDiv() {
  const div = document.getElementById('test');
  if (div) {
    div.remove();
  }
}

describe('JWPlayerProvider', function () {
  beforeEach(() => {
    addDiv();
  });

  afterEach(() => {
    removeDiv();
  });

  describe('init', function () {
    let config;
    let adState;
    let timeState;
    let callbackStorage;
    let utilsMock;

    beforeEach(() => {
      config = { divId: 'test' };
      adState = adStateFactory();
      timeState = timeStateFactory();
      callbackStorage = callbackStorageFactory();
      utilsMock = getUtilsMock();
    });

    it('should trigger failure when jwplayer is missing', function () {
      const provider = JWPlayerProvider(config, null, adState, timeState, callbackStorage, utilsMock, sharedUtils);
      const setupFailed = sinon.spy();
      provider.onEvent(SETUP_FAILED, setupFailed, {});
      provider.init();
      expect(setupFailed.calledOnce).to.be.true;
      const payload = setupFailed.args[0][1];
      expect(payload.errorCode).to.be.equal(-1);
    });

    it('should trigger failure when jwplayer version is under min supported version', function () {
      const jwplayerMock = () => {};
      jwplayerMock.version = '8.20.0';
      const provider = JWPlayerProvider(config, jwplayerMock, adState, timeState, callbackStorage, utilsMock, sharedUtils);
      const setupFailed = sinon.spy();
      provider.onEvent(SETUP_FAILED, setupFailed, {});
      provider.init();
      expect(setupFailed.calledOnce).to.be.true;
      const payload = setupFailed.args[0][1];
      expect(payload.errorCode).to.be.equal(-2);
    });

    it('should trigger failure when div is missing', function () {
      removeDiv();
      const jwplayerMock = () => {};
      const provider = JWPlayerProvider(config, jwplayerMock, adState, timeState, callbackStorage, utilsMock, sharedUtils);
      const setupFailed = sinon.spy();
      provider.onEvent(SETUP_FAILED, setupFailed, {});
      provider.init();
      expect(setupFailed.calledOnce).to.be.true;
      const payload = setupFailed.args[0][1];
      expect(payload.errorCode).to.be.equal(-3);
      addDiv();
      addDiv();
    });

    it('should instantiate the player when uninstantiated', function () {
      const player = getPlayerMock();
      config.playerConfig = {};
      const setupSpy = player.setup = sinon.spy(player.setup);
      const provider = JWPlayerProvider(config, makePlayerFactoryMock(player), adState, timeState, callbackStorage, utilsMock, sharedUtils);
      provider.init();
      expect(setupSpy.calledOnce).to.be.true;
    });

    it('should trigger setup complete when player is already instantiated', function () {
      const player = getPlayerMock();
      player.getState = () => 'idle';
      const provider = JWPlayerProvider(config, makePlayerFactoryMock(player), adState, timeState, callbackStorage, utilsMock, sharedUtils);
      const setupComplete = sinon.spy();
      provider.onEvent(SETUP_COMPLETE, setupComplete, {});
      provider.init();
      expect(setupComplete.calledOnce).to.be.true;
    });

    it('should support multiple setup complete event handlers', function () {
      const player = getPlayerMock();
      player.getState = () => 'idle';
      const provider = JWPlayerProvider(config, makePlayerFactoryMock(player), adState, timeState, callbackStorage, utilsMock, sharedUtils);
      const setupComplete = sinon.spy();
      const setupComplete2 = sinon.spy();
      provider.onEvent(SETUP_COMPLETE, setupComplete, {});
      provider.onEvent(SETUP_COMPLETE, setupComplete2, {});
      provider.init();
      expect(setupComplete.calledOnce).to.be.true;
      expect(setupComplete2.calledOnce).to.be.true;
    });

    it('should not reinstantiate player', function () {
      const player = getPlayerMock();
      player.getState = () => 'idle';
      const setupSpy = player.setup = sinon.spy();
      const provider = JWPlayerProvider(config, makePlayerFactoryMock(player), adState, timeState, callbackStorage, utilsMock, sharedUtils);
      provider.init();
      expect(setupSpy.called).to.be.false;
    });
  });

  describe('getId', function () {
    it('should return configured div id', function () {
      const provider = JWPlayerProvider({ divId: 'test_id' }, undefined, undefined, undefined, undefined, undefined, sharedUtils);
      expect(provider.getId()).to.be.equal('test_id');
    });
  });

  describe('getOrtbVideo', function () {
    it('should populate oRTB Video params', function () {
      const test_media_type = VIDEO_MIME_TYPE.MP4;
      const test_height = 100;
      const test_width = 200;
      const test_start_delay = 5;
      const test_placement = PLACEMENT.ARTICLE;
      const test_battr = 'battr';
      const test_playback_method = PLAYBACK_METHODS.CLICK_TO_PLAY;
      const test_skip = 0;

      const config = { divId: 'test' };
      const player = getPlayerMock();
      const utils = getUtilsMock();

      player.getConfig = () => ({
        advertising: {
          battr: test_battr
        }
      });
      player.getHeight = () => test_height;
      player.getWidth = () => test_width;
      player.getFullscreen = () => true; //

      utils.getPlayerHeight = () => 100;
      utils.getPlayerWidth = () => 200;
      utils.getSupportedMediaTypes = () => [test_media_type];
      utils.getStartDelay = () => test_start_delay;
      utils.getPlacement = () => test_placement;
      utils.getPlaybackMethod = () => test_playback_method;
      utils.isOmidSupported = () => true; //
      utils.getSkipParams = () => ({ skip: test_skip });

      const provider = JWPlayerProvider(config, makePlayerFactoryMock(player), adStateFactory(), {}, {}, utils, sharedUtils);
      provider.init();
      let video = provider.getOrtbVideo();

      expect(video.mimes).to.include(VIDEO_MIME_TYPE.MP4);
      expect(video.protocols).to.include.members([
        PROTOCOLS.VAST_2_0,
        PROTOCOLS.VAST_3_0,
        PROTOCOLS.VAST_4_0,
        PROTOCOLS.VAST_2_0_WRAPPER,
        PROTOCOLS.VAST_3_0_WRAPPER,
        PROTOCOLS.VAST_4_0_WRAPPER
      ]);
      expect(video.h).to.equal(test_height);
      expect(video.w).to.equal(test_width);
      expect(video.startdelay).to.equal(test_start_delay);
      expect(video.placement).to.equal(test_placement);
      expect(video.battr).to.equal(test_battr);
      expect(video.maxextended).to.equal(-1);
      expect(video.boxingallowed).to.equal(1);
      expect(video.playbackmethod).to.include(test_playback_method);
      expect(video.playbackend).to.equal(1);
      expect(video.api).to.have.length(2);
      expect(video.api).to.include.members([API_FRAMEWORKS.VPAID_2_0, API_FRAMEWORKS.OMID_1_0]); //
      expect(video.skip).to.equal(test_skip);
      expect(video.pos).to.equal(7); //

      player.getFullscreen = () => false;
      utils.isOmidSupported = () => false;

      video = provider.getOrtbVideo();
      expect(video).to.not.have.property('pos');
      expect(video.api).to.have.length(1);
      expect(video.api).to.include(API_FRAMEWORKS.VPAID_2_0);
      expect(video.api).to.not.include(API_FRAMEWORKS.OMID_1_0);
    });
  });

  describe('getOrtbContent', function () {
    it('should populate oRTB Content params', function () {
      const test_item = {
        mediaid: 'id',
        file: 'file',
        title: 'title',
        iabCategories: 'iabCategories',
        tags: 'keywords',
      };
      const test_duration = 30;
      let test_playback_mode = PLAYBACK_MODE.VOD;//

      const player = getPlayerMock();
      player.getPlaylistItem = () => test_item;
      const utils = getUtilsMock();

      const timeState = {
        getState: () => ({
          duration: test_duration,
          playbackMode: test_playback_mode
        })
      };

      const provider = JWPlayerProvider({ divId: 'test' }, makePlayerFactoryMock(player), adStateFactory(), timeState, {}, utils, sharedUtils);
      provider.init();

      let content = provider.getOrtbContent();
      expect(content.id).to.be.equal('jw_' + test_item.mediaid);
      expect(content.url).to.be.equal(test_item.file);
      expect(content.title).to.be.equal(test_item.title);
      expect(content.cat).to.be.equal(test_item.iabCategories);
      expect(content.keywords).to.be.equal(test_item.tags);
      expect(content.len).to.be.equal(test_duration);
      expect(content.livestream).to.be.equal(0);//

      test_playback_mode = PLAYBACK_MODE.LIVE;

      content = provider.getOrtbContent();
      expect(content.livestream).to.be.equal(1);

      test_playback_mode = PLAYBACK_MODE.DVR;

      content = provider.getOrtbContent();
      expect(content.livestream).to.be.equal(1);
    });
  });

  describe('setAdTagUrl', function () {
    it('should call playAd', function () {
      const player = getPlayerMock();
      const playAdSpy = player.playAd = sinon.spy();
      const provider = JWPlayerProvider({ divId: 'test' }, makePlayerFactoryMock(player), {}, {}, {}, {}, sharedUtils);
      provider.init();
      provider.setAdTagUrl('tag');
      expect(playAdSpy.called).to.be.true;
      const argument = playAdSpy.args[0][0];
      expect(argument).to.be.equal('tag');
    });
  });

  describe('setAdXml', function () {
    it('should not call loadAdXml when xml is missing', function () {
      const player = getPlayerMock();
      const loadSpy = player.loadAdXml = sinon.spy();
      const provider = JWPlayerProvider({ divId: 'test' }, makePlayerFactoryMock(player), {}, {}, {}, {}, sharedUtils);
      provider.init();
      provider.setAdXml();
      expect(loadSpy.called).to.be.false;
    });

    it('should call loadAdXml with xml and options', function () {
      const player = getPlayerMock();
      const loadSpy = player.loadAdXml = sinon.spy();
      const provider = JWPlayerProvider({ divId: 'test' }, makePlayerFactoryMock(player), {}, {}, {}, {}, sharedUtils);
      provider.init();
      const xml = '<VAST></VAST>';
      const options = {foo: 'bar'};
      provider.setAdXml(xml, options);
      expect(loadSpy.calledOnceWith(xml, options)).to.be.true;
    });
  });

  describe('events', function () {
    it('should register event listener on player', function () {
      const player = getPlayerMock();
      const onSpy = player.on = sinon.spy();
      const provider = JWPlayerProvider({ divId: 'test' }, makePlayerFactoryMock(player), adStateFactory(), timeStateFactory(), callbackStorageFactory(), getUtilsMock(), sharedUtils);
      provider.init();
      const callback = () => {};
      provider.onEvent(PLAY, callback, {});
      expect(onSpy.calledOnce).to.be.true;
      const eventName = onSpy.args[0][0];
      expect(eventName).to.be.equal('play');
    });

    it('should remove event listener on player', function () {
      const player = getPlayerMock();
      const offSpy = player.off = sinon.spy();
      const provider = JWPlayerProvider({ divId: 'test' }, makePlayerFactoryMock(player), adStateFactory(), timeStateFactory(), callbackStorageFactory(), utils, sharedUtils);
      provider.init();
      const callback = () => {};
      provider.onEvent(AD_IMPRESSION, callback, {});
      provider.offEvent(AD_IMPRESSION, callback);
      expect(offSpy.calledOnce).to.be.true;
      const eventName = offSpy.args[0][0];
      expect(eventName).to.be.equal('adViewableImpression');
    });
  });

  describe('destroy', function () {
    it('should remove and null the player', function () {
      const player = getPlayerMock();
      const removeSpy = player.remove = sinon.spy();
      player.remove = removeSpy;
      const provider = JWPlayerProvider({ divId: 'test' }, makePlayerFactoryMock(player), adStateFactory(), timeStateFactory(), callbackStorageFactory(), getUtilsMock(), sharedUtils);
      provider.init();
      provider.destroy();
      provider.destroy();
      expect(removeSpy.calledOnce).to.be.true;
    });
  });
});

describe('adStateFactory', function () {
  const adState = adStateFactory();

  beforeEach(() => {
    adState.clearState();
  });

  it('should update state for ad events', function () {
    const tag = 'tag';
    const adPosition = 'adPosition';
    const timeLoading = 'timeLoading';
    const id = 'id';
    const description = 'description';
    const adsystem = 'adsystem';
    const adtitle = 'adtitle';
    const advertiserId = 'advertiserId';
    const advertiser = 'advertiser';
    const dealId = 'dealId';
    const linear = 'linear';
    const vastversion = 'vastversion';
    const mediaFile = 'mediaFile';
    const adId = 'adId';
    const universalAdId = 'universalAdId';
    const creativeAdId = 'creativeAdId';
    const creativetype = 'creativetype';
    const clickThroughUrl = 'clickThroughUrl';
    const witem = 'witem';
    const wcount = 'wcount';
    const podcount = 'podcount';
    const sequence = 'sequence';

    adState.updateForEvent({
      tag,
      adPosition,
      timeLoading,
      id,
      description,
      adsystem,
      adtitle,
      advertiserId,
      advertiser,
      dealId,
      linear,
      vastversion,
      mediaFile,
      adId,
      universalAdId,
      creativeAdId,
      creativetype,
      clickThroughUrl,
      witem,
      wcount,
      podcount,
      sequence
    });

    const state = adState.getState();
    expect(state.adTagUrl).to.equal(tag);
    expect(state.offset).to.equal(adPosition);
    expect(state.loadTime).to.equal(timeLoading);
    expect(state.vastAdId).to.equal(id);
    expect(state.adDescription).to.equal(description);
    expect(state.adServer).to.equal(adsystem);
    expect(state.adTitle).to.equal(adtitle);
    expect(state.advertiserId).to.equal(advertiserId);
    expect(state.dealId).to.equal(dealId);
    expect(state.linear).to.equal(linear);
    expect(state.vastVersion).to.equal(vastversion);
    expect(state.creativeUrl).to.equal(mediaFile);
    expect(state.adId).to.equal(adId);
    expect(state.universalAdId).to.equal(universalAdId);
    expect(state.creativeId).to.equal(creativeAdId);
    expect(state.creativeType).to.equal(creativetype);
    expect(state.redirectUrl).to.equal(clickThroughUrl);
    expect(state).to.have.property('adPlacementType');
    expect(state.adPlacementType).to.be.undefined;
    expect(state.waterfallIndex).to.equal(witem);
    expect(state.waterfallCount).to.equal(wcount);
    expect(state.adPodCount).to.equal(podcount);
    expect(state.adPodIndex).to.equal(sequence);
  });

  it('should convert placement to oRTB value', function () {
    adState.updateForEvent({
      placement: 'instream'
    });

    let state = adState.getState();
    expect(state.adPlacementType).to.be.equal(PLACEMENT.INSTREAM);

    adState.updateForEvent({
      placement: 'banner'
    });

    state = adState.getState();
    expect(state.adPlacementType).to.be.equal(PLACEMENT.BANNER);

    adState.updateForEvent({
      placement: 'article'
    });

    state = adState.getState();
    expect(state.adPlacementType).to.be.equal(PLACEMENT.ARTICLE);

    adState.updateForEvent({
      placement: 'feed'
    });

    state = adState.getState();
    expect(state.adPlacementType).to.be.equal(PLACEMENT.FEED);

    adState.updateForEvent({
      placement: 'interstitial'
    });

    state = adState.getState();
    expect(state.adPlacementType).to.be.equal(PLACEMENT.INTERSTITIAL);

    adState.updateForEvent({
      placement: 'slider'
    });

    state = adState.getState();
    expect(state.adPlacementType).to.be.equal(PLACEMENT.SLIDER);

    adState.updateForEvent({
      placement: 'floating'
    });

    state = adState.getState();
    expect(state.adPlacementType).to.be.equal(PLACEMENT.FLOATING);
  });
});

describe('timeStateFactory', function () {
  const timeState = timeStateFactory();

  beforeEach(() => {
    timeState.clearState();
  });

  it('should update state for VOD time event', function() {
    const position = 5;
    const test_duration = 30;

    timeState.updateForEvent({
      position,
      duration: test_duration
    });

    const { time, duration, playbackMode } = timeState.getState();
    expect(time).to.be.equal(position);
    expect(duration).to.be.equal(test_duration);
    expect(playbackMode).to.be.equal(PLAYBACK_MODE.VOD);
  });

  it('should update state for LIVE time events', function() {
    const position = 0;
    const test_duration = 0;

    timeState.updateForEvent({
      position,
      duration: test_duration
    });

    const { time, duration, playbackMode } = timeState.getState();
    expect(time).to.be.equal(position);
    expect(duration).to.be.equal(test_duration);
    expect(playbackMode).to.be.equal(PLAYBACK_MODE.LIVE);
  });

  it('should update state for DVR time events', function() {
    const position = -5;
    const test_duration = -30;

    timeState.updateForEvent({
      position,
      duration: test_duration
    });

    const { time, duration, playbackMode } = timeState.getState();
    expect(time).to.be.equal(position);
    expect(duration).to.be.equal(test_duration);
    expect(playbackMode).to.be.equal(PLAYBACK_MODE.DVR);
  });
});

describe('callbackStorageFactory', function () {
  const callbackStorage = callbackStorageFactory();

  beforeEach(() => {
    callbackStorage.clearStorage();
  });

  it('should store callbacks', function () {
    const callback1 = () => 'callback1';
    const eventHandler1 = () => 'eventHandler1';
    callbackStorage.storeCallback('event', eventHandler1, callback1);

    const callback2 = () => 'callback2';
    const eventHandler2 = () => 'eventHandler2';
    callbackStorage.storeCallback('event', eventHandler2, callback2);

    const callback3 = () => 'callback3';

    expect(callbackStorage.getCallback('event', callback1)).to.be.equal(eventHandler1);
    expect(callbackStorage.getCallback('event', callback2)).to.be.equal(eventHandler2);
    expect(callbackStorage.getCallback('event', callback3)).to.be.undefined;
  });

  it('should remove callbacks after retrieval', function () {
    const callback1 = () => 'callback1';
    const eventHandler1 = () => 'eventHandler1';
    callbackStorage.storeCallback('event', eventHandler1, callback1);

    expect(callbackStorage.getCallback('event', callback1)).to.be.equal(eventHandler1);
    expect(callbackStorage.getCallback('event', callback1)).to.be.undefined;
  });

  it('should clear callbacks', function () {
    const callback1 = () => 'callback1';
    const eventHandler1 = () => 'eventHandler1';
    callbackStorage.storeCallback('event', eventHandler1, callback1);

    callbackStorage.clearStorage();
    expect(callbackStorage.getCallback('event', callback1)).to.be.undefined;
  });
});

describe('utils', function () {
  describe('getJwConfig', function () {
    const getJwConfig = utils.getJwConfig;
    it('should return undefined when no config is provided', function () {
      let jwConfig = getJwConfig();
      expect(jwConfig).to.be.undefined;

      jwConfig = getJwConfig(null);
      expect(jwConfig).to.be.undefined;
    });

    it('should set vendor config params to top level', function () {
      const jwConfig = getJwConfig({
        params: {
          vendorConfig: {
            'test': 'a',
            'test_2': 'b'
          }
        }
      });
      expect(jwConfig.test).to.be.equal('a');
      expect(jwConfig.test_2).to.be.equal('b');
    });

    it('should convert video module params', function () {
      const jwConfig = getJwConfig({
        mute: true,
        autoStart: true,
        licenseKey: 'key'
      });

      expect(jwConfig.mute).to.be.true;
      expect(jwConfig.autostart).to.be.true;
      expect(jwConfig.key).to.be.equal('key');
    });

    it('should apply video module params only when absent from vendor config', function () {
      const jwConfig = getJwConfig({
        mute: true,
        autoStart: true,
        licenseKey: 'key',
        params: {
          vendorConfig: {
            mute: false,
            autostart: false,
            key: 'other_key'
          }
        }
      });

      expect(jwConfig.mute).to.be.false;
      expect(jwConfig.autostart).to.be.false;
      expect(jwConfig.key).to.be.equal('other_key');
    });

    it('should not convert undefined properties', function () {
      const jwConfig = getJwConfig({
        params: {
          vendorConfig: {
            test: 'a'
          }
        }
      });

      expect(jwConfig).to.not.have.property('mute');
      expect(jwConfig).to.not.have.property('autostart');
      expect(jwConfig).to.not.have.property('key');
    });

    it('should exclude fallback ad block when setupAds is explicitly disabled', function () {
      const jwConfig = getJwConfig({
        setupAds: false,
        params: {

          vendorConfig: {}
        }
      });

      expect(jwConfig).to.not.have.property('advertising');
    });

    it('should set advertising block when setupAds is allowed', function () {
      const jwConfig = getJwConfig({
        params: {
          vendorConfig: {
            advertising: {
              tag: 'test_tag'
            }
          }
        }
      });

      expect(jwConfig).to.have.property('advertising');
      expect(jwConfig.advertising).to.have.property('tag', 'test_tag');
    });

    it('should fallback to vast plugin', function () {
      const jwConfig = getJwConfig({});

      expect(jwConfig).to.have.property('advertising');
      expect(jwConfig.advertising).to.have.property('client', 'vast');
    });
  });

  describe('getPlayerHeight', function () {
    const getPlayerHeight = utils.getPlayerHeight;

    it('should return height from API when defined', function () {
      const expectedHeight = 500;
      const playerMock = { getHeight: () => expectedHeight };
      expect(getPlayerHeight(playerMock, {})).to.equal(expectedHeight);
    });

    it('should return height from config when API returns undefined', function () {
      const expectedHeight = 500;
      const playerMock = { getHeight: () => undefined };
      expect(getPlayerHeight(playerMock, { height: 500 })).to.equal(expectedHeight);
    });
  });

  describe('getPlayerWidth', function () {
    const getPlayerWidth = utils.getPlayerWidth;

    it('should return width from API when defined', function () {
      const expectedWidth = 1000;
      const playerMock = { getWidth: () => expectedWidth };
      expect(getPlayerWidth(playerMock, {})).to.equal(expectedWidth);
    });

    it('should return width from config when API returns undefined', function () {
      const expectedWidth = 1000;
      const playerMock = { getWidth: () => undefined };
      expect(getPlayerWidth(playerMock, { width: expectedWidth })).to.equal(expectedWidth);
    });

    it('should return undefined when width is string', function () {
      const playerMock = { getWidth: () => undefined };
      expect(getPlayerWidth(playerMock, { width: '50%' })).to.be.undefined;
    });
  });

  describe('getPlayerSizeFromAspectRatio', function () {
    const getPlayerSizeFromAspectRatio = utils.getPlayerSizeFromAspectRatio;
    const testContainer = {
      clientWidth: 640,
      clientHeight: 480
    };

    it('should return an empty object when width and aspectratio are not strings', function () {
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {width: 100})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '1:2', width: 100})).to.deep.equal({});
    });

    it('should return an empty object when aspectratio is malformed', function () {
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '0.5', width: '100%'})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '1-2', width: '100%'})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '1:', width: '100%'})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: ':2', width: '100%'})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: ':', width: '100%'})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '1:2:3', width: '100%'})).to.deep.equal({});
    });

    it('should return an empty object when player container cannot be obtained', function () {
      expect(getPlayerSizeFromAspectRatio({}, {aspectratio: '1:2', width: '100%'})).to.deep.equal({});
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => undefined }, {aspectratio: '1:2', width: '100%'})).to.deep.equal({});
    });

    it('should calculate the size given the width percentage and aspect ratio', function () {
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '2:1', width: '100%'})).to.deep.equal({ height: 320, width: 640 });
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '4:1', width: '70%'})).to.deep.equal({ height: 112, width: 448 });
    });

    it('should return the container height when smaller than the calculated height', function () {
      expect(getPlayerSizeFromAspectRatio({ getContainer: () => testContainer }, {aspectratio: '1:1', width: '100%'})).to.deep.equal({ height: 480, width: 640 });
    });
  });

  describe('getSkipParams', function () {
    const getSkipParams = utils.getSkipParams;

    it('should return an empty object when skip is not configured', function () {
      const skipParams = getSkipParams({});
      expect(skipParams).to.be.empty;
    });

    it('should set skip to false when explicitly configured', function () {
      const skipParams = getSkipParams({
        skipoffset: -1
      });
      expect(skipParams.skip).to.be.equal(0);
      expect(skipParams.skipmin).to.be.undefined;
      expect(skipParams.skipafter).to.be.undefined;
    });

    it('should be skippable when skip offset is set', function () {
      const skipOffset = 3;
      const skipParams = getSkipParams({
        skipoffset: skipOffset
      });
      expect(skipParams.skip).to.be.equal(1);
      expect(skipParams.skipmin).to.be.equal(skipOffset + 2);
      expect(skipParams.skipafter).to.be.equal(skipOffset);
    });
  });

  describe('getSupportedMediaTypes', function () {
    const getSupportedMediaTypes = utils.getSupportedMediaTypes;

    it('should always support VPAID', function () {
      let supportedMediaTypes = getSupportedMediaTypes([]);
      expect(supportedMediaTypes).to.include(VPAID_MIME_TYPE);

      supportedMediaTypes = getSupportedMediaTypes([VIDEO_MIME_TYPE.MP4]);
      expect(supportedMediaTypes).to.include(VPAID_MIME_TYPE);
    });
  });

  describe('getPlacement', function () {
    const getPlacement = utils.getPlacement;

    it('should be INSTREAM when not configured for outstream', function () {
      let adConfig = {};
      let placement = getPlacement(adConfig);
      expect(placement).to.be.equal(PLACEMENT.INSTREAM);

      adConfig = { outstream: false };
      placement = getPlacement(adConfig);
      expect(placement).to.be.equal(PLACEMENT.INSTREAM);
    });

    it('should be FLOATING when player is floating', function () {
      const player = getPlayerMock();
      player.getFloating = () => true;
      const placement = getPlacement({outstream: true}, player);
      expect(placement).to.be.equal(PLACEMENT.FLOATING);
    });

    it('should be the value  defined in the ad config', function () {
      const player = getPlayerMock();
      player.getFloating = () => false;

      let placement = getPlacement({placement: 'banner', outstream: true}, player);
      expect(placement).to.be.equal(PLACEMENT.BANNER);

      placement = getPlacement({placement: 'article', outstream: true}, player);
      expect(placement).to.be.equal(PLACEMENT.ARTICLE);

      placement = getPlacement({placement: 'feed', outstream: true}, player);
      expect(placement).to.be.equal(PLACEMENT.FEED);

      placement = getPlacement({placement: 'interstitial', outstream: true}, player);
      expect(placement).to.be.equal(PLACEMENT.INTERSTITIAL);

      placement = getPlacement({placement: 'slider', outstream: true}, player);
      expect(placement).to.be.equal(PLACEMENT.SLIDER);
    });

    it('should be undefined when undetermined', function () {
      const placement = getPlacement({ outstream: true }, getPlayerMock());
      expect(placement).to.be.undefined;
    });
  });

  describe('getPlaybackMethod', function() {
    const getPlaybackMethod = utils.getPlaybackMethod;

    it('should return autoplay with sound', function() {
      const playbackMethod = getPlaybackMethod({
        autoplay: true,
        mute: false
      });
      expect(playbackMethod).to.equal(PLAYBACK_METHODS.AUTOPLAY);
    });

    it('should return autoplay muted', function() {
      const playbackMethod = getPlaybackMethod({
        autoplay: true,
        mute: true
      });
      expect(playbackMethod).to.equal(PLAYBACK_METHODS.AUTOPLAY_MUTED);
    });

    it('should treat autoplayAdsMuted as mute', function () {
      const playbackMethod = getPlaybackMethod({
        autoplay: true,
        autoplayAdsMuted: true
      });
      expect(playbackMethod).to.equal(PLAYBACK_METHODS.AUTOPLAY_MUTED);
    });

    it('should return click to play', function() {
      let playbackMethod = getPlaybackMethod({ autoplay: false });
      expect(playbackMethod).to.equal(PLAYBACK_METHODS.CLICK_TO_PLAY);

      playbackMethod = getPlaybackMethod({
        autoplay: false,
        autoplayAdsMuted: true
      });
      expect(playbackMethod).to.equal(PLAYBACK_METHODS.CLICK_TO_PLAY);

      playbackMethod = getPlaybackMethod({
        autoplay: false,
        mute: true
      });
      expect(playbackMethod).to.equal(PLAYBACK_METHODS.CLICK_TO_PLAY);
    });
  });

  describe('isOmidSupported', function () {
    const isOmidSupported = utils.isOmidSupported;
    const initialOmidSessionClient = window.OmidSessionClient;
    afterEach(() => {
      window.OmidSessionClient = initialOmidSessionClient;
    });

    it('should be true when Omid is loaded and client is VAST', function () {
      window.OmidSessionClient = {};
      expect(isOmidSupported('vast')).to.be.true;
    });

    it('should be false when Omid is not present', function () {
      expect(isOmidSupported('vast')).to.be.false;
    });

    it('should be false when client is not Vast', function () {
      window.OmidSessionClient = {};
      expect(isOmidSupported('googima')).to.be.false;
      expect(isOmidSupported('freewheel')).to.be.false;
      expect(isOmidSupported('googimadai')).to.be.false;
      expect(isOmidSupported('')).to.be.false;
      expect(isOmidSupported(null)).to.be.false;
      expect(isOmidSupported()).to.be.false;
    });
  });

  describe('getIsoLanguageCode', function () {
    const sampleAudioTracks = [{language: 'ht'}, {language: 'fr'}, {language: 'es'}, {language: 'pt'}];

    it('should return undefined when audio tracks are unavailable', function () {
      const player = getPlayerMock();
      let languageCode = utils.getIsoLanguageCode(player);
      expect(languageCode).to.be.undefined;
      player.getAudioTracks = () => [];
      languageCode = utils.getIsoLanguageCode(player);
      expect(languageCode).to.be.undefined;
    });

    it('should return the first audio track language code if the getCurrentAudioTrack returns undefined', function () {
      const player = getPlayerMock();
      player.getAudioTracks = () => sampleAudioTracks;
      const languageCode = utils.getIsoLanguageCode(player);
      expect(languageCode).to.be.equal('ht');
    });

    it('should return the first audio track  language code if the getCurrentAudioTrack returns null', function () {
      const player = getPlayerMock();
      player.getAudioTracks = () => sampleAudioTracks;
      player.getCurrentAudioTrack = () => null;
      const languageCode = utils.getIsoLanguageCode(player);
      expect(languageCode).to.be.equal('ht');
    });

    it('should return the first audio track language code if the getCurrentAudioTrack returns -1', function () {
      const player = getPlayerMock();
      player.getAudioTracks = () => sampleAudioTracks;
      player.getCurrentAudioTrack = () => -1;
      const languageCode = utils.getIsoLanguageCode(player);
      expect(languageCode).to.be.equal('ht');
    });

    it('should return the right audio track language code', function () {
      const player = getPlayerMock();
      player.getAudioTracks = () => sampleAudioTracks;
      player.getCurrentAudioTrack = () => 2;
      const languageCode = utils.getIsoLanguageCode(player);
      expect(languageCode).to.be.equal('es');
    });
  });

  describe('getJwEvent', function () {
    const getJwEvent = utils.getJwEvent;
    it('should map known events', function () {
      expect(getJwEvent(SETUP_COMPLETE)).to.equal('ready');
      expect(getJwEvent(SEEK_END)).to.equal('seeked');
      expect(getJwEvent(AD_STARTED)).to.equal(AD_IMPRESSION);
    });

    it('should return event name when not mapped', function () {
      expect(getJwEvent('custom')).to.equal('custom');
    });
  });

  describe('getSegments', function () {
    const getSegments = utils.getSegments;
    it('should return undefined for empty input', function () {
      expect(getSegments()).to.be.undefined;
      expect(getSegments([])).to.be.undefined;
    });

    it('should convert segments to objects', function () {
      const segs = ['a', 'b'];
      expect(getSegments(segs)).to.deep.equal([
        {id: 'a'},
        {id: 'b'}
      ]);
    });
  });

  describe('getContentDatum', function () {
    const getContentDatum = utils.getContentDatum;
    it('should return undefined when no data provided', function () {
      expect(getContentDatum()).to.be.undefined;
    });

    it('should set media id and segments', function () {
      const segments = [{id: 'x'}];
      expect(getContentDatum('id1', segments)).to.deep.equal({
        name: 'jwplayer.com',
        segment: segments,
        ext: { cids: ['id1'], segtax: 502 }
      });
    });

    it('should set only media id when segments missing', function () {
      expect(getContentDatum('id2')).to.deep.equal({
        name: 'jwplayer.com',
        ext: { cids: ['id2'] }
      });
    });
  });
});
