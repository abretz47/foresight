import React, { Component } from 'react';
import { Text, View, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { connect } from 'react-redux';
import { getUser } from '../../reducer';
import { styles, COLORS } from '../styles/styles';
import { LoginNavigationProp } from '../types/navigation';
import { getUsers } from '../data/db';

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

interface State {
  username: string;
  allUsers: string[];
  showSuggestions: boolean;
  inputHeight: number;
}

class Login extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { username: '', allUsers: [], showSuggestions: false, inputHeight: 50 };
  }

  componentDidMount() {
    getUsers().then((users) => this.setState({ allUsers: users, username: users[0] ?? '' }));
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

  get filteredUsers(): string[] {
    const { username, allUsers, showSuggestions } = this.state;
    if (!showSuggestions || allUsers.length === 0) return [];
    if (!username.trim()) return allUsers;
    const lower = username.toLowerCase();
    return allUsers.filter((u) => u.toLowerCase().includes(lower));
  }

  render() {
    const { username } = this.state;
    const suggestions = this.filteredUsers;

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

        {/* Login card */}
        <View style={loginStyles.cardWrapper}>
          <View style={styles.card}>
            <Text style={loginStyles.cardTitle}>Welcome Back</Text>
            <Text style={loginStyles.cardHint}>Enter your name to continue</Text>

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
        </View>
      </View>
    );
  }
}

const loginStyles = StyleSheet.create({
  brandHeader: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 32,
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
  continueBtnLabel: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
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
