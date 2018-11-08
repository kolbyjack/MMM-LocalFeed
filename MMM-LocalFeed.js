// MMM-LocalFeed.js

function setDefault(obj, field, value) {
  if (!(field in obj)) {
    obj[field] = value;
  }
}

Module.register("MMM-LocalFeed", {
  // Default module config
  defaults: {
    // time an item is displayed in seconds if not specified in event
    defaultDuration: 3600,
    updateSpeed: 1000,
    rotationInterval: 30,
  },

  start: function() {
    var self = this;

    self.items = [];
    self.itemIndex = 0;
    self.subItemIndex = 0;
    self.lastRotation = 0;

    setInterval(function() { self.tick(); }, 1000);
  },

  getDom: function() {
    var self = this;
    var wrapper = document.createElement("div");

    wrapper.className += "small";
    if (self.items.length > 0) {
      var item = self.items[self.itemIndex];
      wrapper.innerHTML = item.html[self.subItemIndex];
    }

    return wrapper;
  },

  notificationReceived: function(notification, payload, sender) {
    var self = this;

    if (notification === "LOCALFEED_ADD_ITEM") {
      self.fixupPayload(payload, sender);
      self.addItem(payload);
    } else if (notification === "LOCALFEED_REMOVE_ITEM") {
      self.fixupPayload(payload, sender);
      self.removeItem(payload);
    }
  },

  fixupPayload: function(payload, sender) {
    var self = this;

    payload.sender = sender;
    payload.received = (new Date().getTime() * 0.001) | 0;
    setDefault(payload, "id", null);
    setDefault(payload, "html", [""]);
    setDefault(payload, "duration", self.config.defaultDuration);

    if (!Array.isArray(payload.html)) {
      payload.html = [payload.html];
    }
  },

  scheduleUpdate: function() {
    var self = this;

    self.lastRotation = (new Date().getTime() * 0.001) | 0;
    self.updateDom(self.config.updateSpeed);
  },

  addItem: function(payload) {
    var self = this;

    var idx = -1;
    if (payload.id !== null) {
      idx = self.items.findIndex((e) => { return e.sender === payload.sender && e.id === payload.id; });
    }

    if (idx === -1) {
      idx = self.items.push(payload) - 1;
    } else {
      self.items[idx] = payload;
    }

    if (self.itemIndex === idx) {
      if (self.subItemIndex >= payload.html.length) {
        self.itemIndex = (self.itemIndex + 1) % (self.items.length || 1);
        self.subItemIndex = 0;
      }
      if (self.lastRotation === 0) {
        self.scheduleUpdate();
      } else {
        self.updateDom();
      }
    }
  },

  removeItem: function(payload) {
    var self = this;

    var idx = self.items.findIndex((e) => { return e.sender === payload.sender && e.id === payload.id; });
    if (idx === -1) {
      return;
    }

    self.items.splice(idx, 1);
    if (self.itemIndex === idx) {
      self.itemIndex %= (self.items.length || 1);
      self.subItemIndex = 0;
      self.scheduleUpdate();
    }
  },

  tick: function() {
    var self = this;
    var now = (new Date().getTime() * 0.001) | 0;
    var activeItemRemoved = false;

    for (var i = self.items.length - 1; i >= 0; --i) {
      var item = self.items[i];

      if (now - item.received >= item.duration) {
        self.items.splice(i, 1);
        if (self.itemIndex === i) {
          activeItemRemoved = true;
          self.subItemIndex = -1;
        } else if (self.itemIndex > i) {
          --self.itemIndex;
        }
      }
    }

    if (activeItemRemoved || now - self.lastRotation >= self.config.rotationInterval) {
      if (++self.subItemIndex >= self.items[self.itemIndex].html.length) {
        self.itemIndex = (self.itemIndex + 1) % (self.items.length || 1);
        self.subItemIndex = 0;
      }
      self.scheduleUpdate();
    }
  }
});
