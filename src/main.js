import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import 'primeicons/primeicons.css';
import App from './App.vue';
import { configureWorkspaceGateway, clearWorkspace, warnAboutPersistence, restoreSession } from './shared/application/workspace.js';
import { RestWorkspaceGateway } from './shared/infrastructure/rest-workspace-gateway.js';
import { router } from './router.js';
import { language } from './shared/presentation/i18n.js';
import { primeVueLocale } from './shared/presentation/primevue-locale.js';
import './styles.css';

const theme = definePreset(Aura, { semantic: { primary: { 50: '#eaf2fe', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#0b5ed7', 600: '#0b5ed7', 700: '#084bae', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' } } });
const app = createApp(App);
configureWorkspaceGateway(new RestWorkspaceGateway({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5080/api',
  onSessionExpired: clearWorkspace,
  onPersistenceWarning: warnAboutPersistence,
}));
app.use(PrimeVue, { locale: primeVueLocale(language.value), theme: { preset: theme, options: { darkModeSelector: false } } });
for (const [name, component] of Object.entries({ Button, InputText, Select, Dialog, Textarea, Checkbox, Message })) app.component(`P${name}`, component);
restoreSession().then(() => app.use(router).mount('#app'));
