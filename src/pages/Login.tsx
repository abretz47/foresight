import React, { Component } from 'react';
import { Text, View, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { connect } from 'react-redux';
import { getUser } from '../../reducer';
import { styles, COLORS } from '../styles/styles';
import { LoginNavigationProp } from '../types/navigation';
import { getUsers } from '../data/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface User {
  id: string;
  name: string;
}

interface Props {
  navigation: LoginNavigationProp;
  user: User;
  getUser: () => void;
}

const SUGGESTION_HIDE_DELAY = 150;

type AuthMode = 'local' | 'cloud';
type CloudSubMode = 'signin' | 'signup';

interface State {
  // local tab
  username: string;
  allUsers: string[];
  showSuggestions: boolean;
  inputHeight: number;
  // cloud tab
  authMode: AuthMode;
  cloudEmail: string;
  cloudPassword: string;
  cloudDisplayName: string;
  cloudSubMode: CloudSubMode;
  isLoading: boolean;
  cloudError: string;
  /** true while we check AsyncStorage for a persisted Supabase session */
  checkingSession: boolean;
}

class Login extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      username: '',
      allUsers: [],
      showSuggestions: false,
      inputHeight: 50,
      authMode: 'local',
      cloudEmail: '',
      cloudPassword: '',
      cloudDisplayName: '',
      cloudSubMode: 'signin',
      isLoading: false,
      cloudError: '',
      checkingSession: isSupabaseConfigured(),
    };
  }

  /** Derive the user's display name from a Supabase user object. */
  private static userDisplayName(
    userMeta: Record<string, unknown> | undefined,
    email: string | undefined
  ): string {
    return (
      (userMeta?.display_name as string | undefined) ??
      (email?.split('@')[0] || 'User')
    );
  }

  async componentDidMount() {
    // If Supabase is configured, check whether a valid session is already
    // stored in AsyncStorage (the sb-*-auth-token persisted by the SDK).
    // Navigate straight to Home on success; any error falls through to local login.
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (session) {
          const name = Login.userDisplayName(
            session.user?.user_metadata,
            session.user?.email
          );
          this.props.navigation.navigate('Home', { user: name });
          return;
        }
      } catch (e) {
        // Supabase host unreachable or token refresh failed – fall through to
        // show the normal login form so Local mode still works.
        console.warn('[Foresight] Session restore failed, showing login form:', e);
      }
    }

    const users = await getUsers();
    this.setState({ allUsers: users, username: users[0] ?? '', checkingSession: false });
  }

  handleLogin = () => {
    const username = this.state.username.trim();
    if (!username) {
      alert('Please enter your name to continue.');
      return;
    }
    this.props.navigation.navigate('Home', { user: username });
  };

  handleChangeText = (text: string) => {
    this.setState({ username: text, showSuggestions: true });
  };

  handleSelectUser = (name: string) => {
    this.setState({ username: name, showSuggestions: false });
  };

  handleCloudAuth = async () => {
    const { cloudEmail, cloudPassword, cloudDisplayName, cloudSubMode } = this.state;
    const email = cloudEmail.trim();
    const password = cloudPassword.trim();
    const displayName = cloudDisplayName.trim();

    if (!email || !password) {
      this.setState({ cloudError: 'Please enter your email and password.' });
      return;
    }
    if (cloudSubMode === 'signup' && !displayName) {
      this.setState({ cloudError: 'Please enter a display name.' });
      return;
    }
    if (!supabase) {
      this.setState({ cloudError: 'Cloud auth is not configured. Please use Local mode.' });
      return;
    }

    this.setState({ isLoading: true, cloudError: '' });

    try {
      if (cloudSubMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) {
          this.setState({ cloudError: error.message, isLoading: false });
          return;
        }
        this.props.navigation.navigate('Home', { user: displayName });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          this.setState({ cloudError: error.message, isLoading: false });
          return;
        }
        const name = Login.userDisplayName(data.user?.user_metadata, email);
        this.props.navigation.navigate('Home', { user: name });
      }
    } catch (err) {
      this.setState({ cloudError: 'An unexpected error occurred.', isLoading: false });
    }
  };

  get filteredUsers(): string[] {
    const { username, allUsers, showSuggestions } = this.state;
    if (!showSuggestions || allUsers.length === 0) return [];
    if (!username.trim()) return allUsers;
    const lower = username.toLowerCase();
    return allUsers.filter((u) => u.toLowerCase().includes(lower));
  }

  render() {
    const { username, authMode, cloudEmail, cloudPassword, cloudDisplayName, cloudSubMode, isLoading, cloudError, checkingSession } = this.state;
    const suggestions = this.filteredUsers;
    const cloudAvailable = isSupabaseConfigured();

    // Show a brief loading screen while we check for a persisted Supabase session.
    if (checkingSession) {
      return (
        <View style={styles.template}>
          <View style={loginStyles.brandHeader}>
            <View style={loginStyles.logoCircle}>
              <Text style={loginStyles.logoText}>⛳</Text>
            </View>
            <Text style={loginStyles.appTitle}>Foresight</Text>
            <Text style={loginStyles.appSubtitle}>Golf Range Tracker</Text>
          </View>
          <View style={loginStyles.sessionCheckContainer}>
            <ActivityIndicator size="large" color={COLORS.textLight} />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.template}>
        {/* Branding header */}
        <View style={loginStyles.brandHeader}>
          <View style={loginStyles.logoCircle}>
            <Text style={loginStyles.logoText}>⛳</Text>
          </View>
          <Text style={loginStyles.appTitle}>Foresight</Text>
          <Text style={loginStyles.appSubtitle}>Golf Range Tracker</Text>
        </View>

        {/* Tab switcher */}
        <View style={loginStyles.tabRow}>
          <TouchableOpacity
            style={[loginStyles.tab, authMode === 'local' && loginStyles.tabActive]}
            onPress={() => this.setState({ authMode: 'local', cloudError: '' })}
          >
            <Text style={[loginStyles.tabLabel, authMode === 'local' && loginStyles.tabLabelActive]}>
              Local
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[loginStyles.tab, authMode === 'cloud' && loginStyles.tabActive]}
            onPress={() => this.setState({ authMode: 'cloud', cloudError: '' })}
          >
            <Text style={[loginStyles.tabLabel, authMode === 'cloud' && loginStyles.tabLabelActive]}>
              Cloud Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Login card */}
        <View style={loginStyles.cardWrapper}>
          {authMode === 'local' ? (
            <View style={styles.card}>
              <Text style={loginStyles.cardTitle}>Welcome Back</Text>
              <Text style={loginStyles.cardHint}>Enter your name to continue locally</Text>

              <View style={[comboStyles.comboWrapper]}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={this.handleChangeText}
                  onFocus={() => this.setState({ showSuggestions: true })}
                  onBlur={() =>
                    setTimeout(() => this.setState({ showSuggestions: false }), SUGGESTION_HIDE_DELAY)
                  }
                  onLayout={(e) =>
                    this.setState({ inputHeight: e.nativeEvent.layout.height + e.nativeEvent.layout.y })
                  }
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                />
                {suggestions.length > 0 && (
                  <View style={[comboStyles.dropdown, { top: this.state.inputHeight }]}>
                    <FlatList
                      data={suggestions}
                      keyExtractor={(item) => item}
                      keyboardShouldPersistTaps="handled"
                      style={comboStyles.list}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={comboStyles.item}
                          onPress={() => this.handleSelectUser(item)}
                        >
                          <Text style={comboStyles.itemText}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>

              <TouchableOpacity style={loginStyles.continueBtn} onPress={this.handleLogin}>
                <Text style={loginStyles.continueBtnLabel}>Continue  →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={loginStyles.cardTitle}>
                {cloudSubMode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
              <Text style={loginStyles.cardHint}>
                {cloudSubMode === 'signin'
                  ? 'Sign in to sync your data across devices'
                  : 'Create an account to back up your data'}
              </Text>

              {!cloudAvailable && (
                <View style={loginStyles.warningBox}>
                  <Text style={loginStyles.warningText}>
                    ⚠️ Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and
                    EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.
                  </Text>
                </View>
              )}

              {cloudSubMode === 'signup' && (
                <>
                  <Text style={styles.label}>Display Name</Text>
                  <TextInput
                    style={[styles.textInput, loginStyles.cloudInput]}
                    value={cloudDisplayName}
                    onChangeText={(text) => this.setState({ cloudDisplayName: text, cloudError: '' })}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                </>
              )}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.textInput, loginStyles.cloudInput]}
                value={cloudEmail}
                onChangeText={(text) => this.setState({ cloudEmail: text, cloudError: '' })}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.textInput, loginStyles.cloudInput]}
                value={cloudPassword}
                onChangeText={(text) => this.setState({ cloudPassword: text, cloudError: '' })}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />

              {cloudError !== '' && (
                <Text style={loginStyles.errorText}>{cloudError}</Text>
              )}

              <TouchableOpacity
                style={[loginStyles.continueBtn, isLoading && loginStyles.continueBtnDisabled]}
                onPress={this.handleCloudAuth}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.textLight} />
                ) : (
                  <Text style={loginStyles.continueBtnLabel}>
                    {cloudSubMode === 'signin' ? 'Sign In  →' : 'Create Account  →'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={loginStyles.toggleSubMode}
                onPress={() =>
                  this.setState({
                    cloudSubMode: cloudSubMode === 'signin' ? 'signup' : 'signin',
                    cloudError: '',
                  })
                }
              >
                <Text style={loginStyles.toggleSubModeText}>
                  {cloudSubMode === 'signin'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }
}

const loginStyles = StyleSheet.create({
  brandHeader: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 36,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 14,
    color: COLORS.accentLight,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.textLight,
  },
  cardWrapper: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  cloudInput: {
    marginBottom: 14,
  },
  continueBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueBtnLabel: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  warningText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  toggleSubMode: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleSubModeText: {
    color: COLORS.primaryLight,
    fontSize: 14,
    fontWeight: '600',
  },
  sessionCheckContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const comboStyles = StyleSheet.create({
  comboWrapper: {
    zIndex: 10,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 12,
    zIndex: 20,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  list: {
    borderRadius: 12,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  itemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});

const mapStateToProps = ({ user }: { user: User }) => ({ user });
const mapDispatchToProps = { getUser };

export default connect(mapStateToProps, mapDispatchToProps)(Login);
