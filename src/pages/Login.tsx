import React, { Component } from 'react';
import { Text, View, Button, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { connect } from 'react-redux';
import { getUser } from '../../reducer';
import { styles } from '../styles/styles';
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
        <View style={styles.homeContainer}>
          <View style={styles.row}>
            <View style={[styles.column, comboStyles.comboWrapper]}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={this.handleChangeText}
                onFocus={() => this.setState({ showSuggestions: true })}
                onBlur={() => setTimeout(() => this.setState({ showSuggestions: false }), SUGGESTION_HIDE_DELAY)}
                onLayout={(e) => this.setState({ inputHeight: e.nativeEvent.layout.height + e.nativeEvent.layout.y })}
                placeholder="Enter your name"
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
          </View>
          <View style={styles.buttonRow}>
            <View style={styles.buttonContainer}>
              <Button title="Continue" onPress={this.handleLogin} color="black" />
            </View>
          </View>
        </View>
      </View>
    );
  }
}

const comboStyles = StyleSheet.create({
  comboWrapper: {
    flex: 1,
    zIndex: 10,
  },
  dropdown: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderColor: '#000',
    borderWidth: 1,
    borderRadius: 8,
    zIndex: 20,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  list: {
    borderRadius: 8,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  itemText: {
    fontSize: 18,
  },
});

const mapStateToProps = ({ user }: { user: User }) => ({ user });
const mapDispatchToProps = { getUser };

export default connect(mapStateToProps, mapDispatchToProps)(Login);
