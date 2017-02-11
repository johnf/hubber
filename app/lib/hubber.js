import path from 'path';
import architect from 'architect';

import log from 'electron-log';

class Hubber {
  constructor(store) {
    log.debug('Creating Hubber');

    this.store = store;
    this.startArchitect();
  }

  static setupIoT(services) {
    const thingShadows = services.iot.thingShadows;

    thingShadows.on('message', (topic, payloadJSON) => {
      log.debug(`received message on topic ${topic}`, payloadJSON.toString());
      const pluginName = topic.split('/')[2];
      const payload = JSON.parse(payloadJSON);

      const plugin = services[pluginName];
      if (!plugin) {
        log.info(`plugin ${pluginName} not installed`);
        // TODO: log this and expose in web portal somehow or notify the user

        return;
      }

      plugin.execute(payload);
    });
  }

  architectConfig() {
    const state = this.store.getState();

    const initialPlugins = state.plugins;

    const plugins = initialPlugins.map((plugin) => {
      if (typeof plugin === 'object') {
        return { ...plugin };
      }

      return plugin;
    });

    const configPlugin = {
      setup: (options, imports, register) => {
        register(null, {
          config: {
            get: (key) => {
              const localState = this.store.getState();
              return localState[key];
            },
          },
        });
      },
      provides: ['config'],
      consumes: [],
    };

    plugins.push(configPlugin);
    console.error(plugins);

    const basePath = path.join(__dirname, '..', '..');
    const architectConfig = architect.resolveConfig(plugins, basePath);

    return architectConfig;
  }

  startArchitect() {
    const config = this.architectConfig();
    architect.createApp(config, (err, app) => {
      if (err) {
        // TODO: Show some error in web app
        log.error(err);
        throw err;
      }
      log.info('plugins ready');

      if (app.services.iot) {
        this.setupIoT(app.services);
      }
    });
  }
}

export default Hubber;
