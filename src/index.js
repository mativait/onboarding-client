import React from 'react';
import { render } from 'react-dom';
import config from 'react-global-configuration';
import { createStore, combineReducers, compose, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { reducer as formReducer } from 'redux-form';
import { Provider as TranslationProvider } from 'retranslate';
import { Provider as ReduxProvider } from 'react-redux';
import { Router, Route, browserHistory } from 'react-router';
import { syncHistoryWithStore, routerReducer, routerMiddleware } from 'react-router-redux';
import mixpanel from 'mixpanel-browser';
import MixpanelProvider from 'react-mixpanel';
import GoogleAnalytics from 'react-ga';

import initializeConfiguration from './config/config';
import translations from './translations';
import './index.scss';

import requireAuthentication from './requireAuthentication';
import LoginPage, { reducer as loginReducer, actions as loginActions } from './login';
import TermsOfUse from './termsOfUse';
import NewUser from './newUserFlow/newUser';
import NonMember from './newUserFlow/nonMember';
import SignUpPage from './newUserFlow/signUp';
import Payment from './newUserFlow/payment';
import { reducer as exchangeReducer, actions as exchangeActions } from './exchange';
import trackingReducer from './tracking';
import { reducer as comparisonReducer, actions as comparisonActions } from './comparison';
import { reducer as quizReducer, actions as quizActions } from './quiz';
import { router } from './router';
import Quiz from './quiz/Quiz';

// import { reducer as quizReducer } from './quiz';
import App from './app';
import AccountPage, { reducer as accountReducer, actions as accountActions } from './account';
import Steps, {
  SelectSources,
  TransferFutureCapital,
  ConfirmMandate,
  Success,
} from './onboardingFlow';

const rootReducer = combineReducers({
  routing: routerReducer,
  login: loginReducer,
  exchange: exchangeReducer, // exchage of funds
  comparison: comparisonReducer,
  account: accountReducer,
  tracking: trackingReducer,
  form: formReducer,
  quiz: quizReducer,
});

const composeEnhancers = (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose; // eslint-disable-line

const routingMiddleware = routerMiddleware(browserHistory);

const store = createStore(rootReducer, composeEnhancers(applyMiddleware(thunk, routingMiddleware)));

const history = syncHistoryWithStore(browserHistory, store);

function getUserAndConversionData() {
  const { login } = store.getState();
  if (login.token
    && (!(login.user || login.loadingUser)
    || !(login.userConversion || login.loadingUserConversion))
  ) {
    Promise.all([
      store.dispatch(loginActions.getUserConversion()),
      store.dispatch(loginActions.getUser()),
    ]).then(() =>
      store.dispatch(router.selectRouteForState()),
    );
  }
}

function getDataForApp(nextState) {
  store.dispatch(loginActions.mapUrlQueryParamsToState(nextState.location.query));
  if (quizActions.isRouteToQuiz(nextState.location)) {
    store.dispatch(quizActions.routeToQuiz());
  }
  getUserAndConversionData();
}

function initApp(nextState) {
  store.dispatch(loginActions.handleLoginCookies());
  getDataForApp(nextState);
}

function getSourceAndTargetFundsData() {
  const { login, exchange } = store.getState();
  if (login.token && !(exchange.sourceFunds || exchange.loadingSourceFunds ||
    exchange.targetFunds || exchange.loadingTargetFunds)) {
    store.dispatch(exchangeActions.getSourceFunds());
    store.dispatch(exchangeActions.getTargetFunds());
  }
}

function getComparisonData() {
  const { login, comparison } = store.getState();
  if (login.token && !(comparison.comparison || comparison.loadingComparison)) {
    store.dispatch(comparisonActions.getComparison());
  }
}

function getDataForFlow(nextState) {
  store.dispatch(exchangeActions.mapUrlQueryParamsToState(nextState.location.query));
  getSourceAndTargetFundsData();
  getComparisonData();
}

function getInitialCapitalData() {
  const { login, account } = store.getState();
  if (login.token && login.user && login.user.memberNumber &&
    !(account.initialCapital || account.loadingInitialCapital)) {
    store.dispatch(accountActions.getInitialCapital());
  }
}

function getPendingExchangesData() {
  const { login, exchange } = store.getState();
  if (login.token && !(exchange.pendingExchanges || exchange.loadingPendingExchanges)) {
    store.dispatch(exchangeActions.getPendingExchanges());
  }
}

function getDataForAccount() {
  getSourceAndTargetFundsData();
  getInitialCapitalData();
  getPendingExchangesData();
}

function getLanguage() {
  const params = window.location.search;

  if (params.indexOf('language=et') >= 0) {
    return 'et';
  } else if (params.indexOf('language=en') >= 0) {
    return 'en';
  }
  return 'et';
}

function scrollToTop() {
  window.scrollTo(0, 0);
}

initializeConfiguration();

mixpanel.init(config.get('mixpanelKey'));

GoogleAnalytics.initialize('UA-76855836-1', {
  debug: false,
  titleCase: false,
  gaOptions: {
    alwaysSendReferrer: true,
  },
});

function trackPageView() {
  GoogleAnalytics.pageview(window.location.href);
}

render((
  <MixpanelProvider mixpanel={mixpanel}>
    <TranslationProvider
      messages={translations} language={getLanguage()} fallbackLanguage="et"
    >
      <ReduxProvider store={store}>
        <Router onUpdate={trackPageView} history={history}>
          <Route path="/login" component={LoginPage} />
          <Route path="/terms-of-use" component={TermsOfUse} />
          <Route path="/" component={requireAuthentication(App)} onEnter={initApp}>
            <Route path="/quiz" component={Quiz} onEnter={getDataForFlow} />

            <Route path="/steps" onEnter={getDataForFlow}>
              <Route path="new-user" component={NewUser} onEnter={scrollToTop} />
              <Route path="non-member" component={NonMember} />
              <Route path="signup" component={SignUpPage} />
              <Route path="payment" component={Payment} />
            </Route>

            <Route path="/steps" component={Steps} onEnter={getDataForFlow}>
              <Route path="select-sources" component={SelectSources} onEnter={scrollToTop} />
              <Route
                path="transfer-future-capital"
                component={TransferFutureCapital}
                onEnter={scrollToTop}
              />
              <Route path="confirm-mandate" component={ConfirmMandate} onEnter={scrollToTop} />
            </Route>
            <Route path="/steps/success" component={Success} />
            <Route path="/account" component={AccountPage} onEnter={getDataForAccount} />
          </Route>
        </Router>
      </ReduxProvider>
    </TranslationProvider>
  </MixpanelProvider>
), document.getElementById('root'));
