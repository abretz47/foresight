import React, { Component } from 'react';
import { Text, View, Button, TextInput } from 'react-native';
import { connect } from 'react-redux';
import { getUser } from '../../reducer';
import { styles } from '../styles/styles';

interface Props {
  navigation: any;
  user: any;
  getUser: () => void;
}

interface State {
  username: string;
}

class Login extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { username: '' };
  }

  handleLogin = () => {
    const username = this.state.username.trim();
    if (!username) {
      alert('Please enter your name to continue.');
      return;
    }
    this.props.navigation.navigate('Home', { user: username });
  };

  render() {
    return (
      <View style={styles.template}>
        <View style={styles.homeContainer}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.textInput}
                value={this.state.username}
                onChangeText={(text) => this.setState({ username: text })}
                placeholder="Enter your name"
                autoCapitalize="none"
              />
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

const mapStateToProps = ({ user }: { user: any }) => ({ user });
const mapDispatchToProps = { getUser };

export default connect(mapStateToProps, mapDispatchToProps)(Login);
