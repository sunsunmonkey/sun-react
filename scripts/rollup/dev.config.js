import reactConfig from './react.config';
import reactDomConfig from './react-dom.config';
import reactNoopRendererConfig from './react-noop-renderer.config';

export default () => {
	return [...reactDomConfig, ...reactConfig, ...reactNoopRendererConfig];
};
