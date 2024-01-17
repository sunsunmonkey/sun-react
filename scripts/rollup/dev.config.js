import reactConfig from './react.config';
import reactDomConfig from './react-dom.config';
export default () => {
	return [...reactDomConfig, ...reactConfig];
};
