import { addIcons } from 'ionicons';
import {
  // Brand / general
  cubeOutline,
  // Admin / dashboards
  homeOutline,
  barChartOutline,
  analyticsOutline,
  pieChartOutline,
  trendingUpOutline,
  trendingDownOutline,
  // Ventas
  receiptOutline,
  cashOutline,
  returnUpBackOutline,
  libraryOutline,
  cartOutline,
  // Producción / inventario
  hammerOutline,
  leafOutline,
  bookOutline,
  cubeOutline as cubeInventory,
  createOutline,
  documentTextOutline,
  // Alertas / boosts
  notificationsOutline,
  flashOutline,
  // Config
  settingsOutline,
  personOutline,
  logOutOutline,
  // States
  warningOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  mailOpenOutline,
  arrowDownCircleOutline,
  arrowForwardOutline,
  addOutline,
  closeOutline,
  // Clientes / acciones de card
  trashOutline,
  copyOutline,
  refreshOutline,
  linkOutline,
  chevronDownOutline,
  chevronUpOutline,
  timeOutline,
  calendarOutline,
  archiveOutline,
  arrowUndoOutline,
  chatboxEllipsesOutline,
} from 'ionicons/icons';

/**
 * Registra todos los iconos que la app usa.
 * Llamar UNA vez al bootstrap (main.ts).
 *
 * Cada entrada del map: clave (nombre del icono usado en `<ion-icon name="...">`)
 * → módulo SVG importado.
 */
export function registerAppIcons(): void {
  addIcons({
    // brand
    'cube-outline': cubeOutline,
    // admin / dashboards
    'home-outline': homeOutline,
    'bar-chart-outline': barChartOutline,
    'analytics-outline': analyticsOutline,
    'pie-chart-outline': pieChartOutline,
    'trending-up-outline': trendingUpOutline,
    'trending-down-outline': trendingDownOutline,
    // ventas
    'receipt-outline': receiptOutline,
    'cash-outline': cashOutline,
    'return-up-back-outline': returnUpBackOutline,
    'library-outline': libraryOutline,
    'cart-outline': cartOutline,
    // producción / inventario
    'hammer-outline': hammerOutline,
    'leaf-outline': leafOutline,
    'book-outline': bookOutline,
    'cube-inventory': cubeInventory,
    'create-outline': createOutline,
    'document-text-outline': documentTextOutline,
    // alertas / boosts
    'notifications-outline': notificationsOutline,
    'flash-outline': flashOutline,
    // config
    'settings-outline': settingsOutline,
    'person-outline': personOutline,
    'log-out-outline': logOutOutline,
    // states / inline
    'warning-outline': warningOutline,
    'checkmark-circle-outline': checkmarkCircleOutline,
    'alert-circle-outline': alertCircleOutline,
    'mail-open-outline': mailOpenOutline,
    'arrow-down-circle-outline': arrowDownCircleOutline,
    'arrow-forward-outline': arrowForwardOutline,
    'add-outline': addOutline,
    'close-outline': closeOutline,
    // Clientes / acciones
    'trash-outline': trashOutline,
    'copy-outline': copyOutline,
    'refresh-outline': refreshOutline,
    'link-outline': linkOutline,
    'chevron-down-outline': chevronDownOutline,
    'chevron-up-outline': chevronUpOutline,
    'time-outline': timeOutline,
    'calendar-outline': calendarOutline,
    'archive-outline': archiveOutline,
    'arrow-undo-outline': arrowUndoOutline,
    'chatbox-ellipses-outline': chatboxEllipsesOutline,
  });
}
