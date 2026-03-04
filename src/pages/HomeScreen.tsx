import React, { Component } from 'react';
import { View, Text, Alert, TouchableOpacity, Modal, TextInput, Share, StyleSheet, ScrollView, Platform } from 'react-native';
import { styles } from '../styles/styles';
import { HomeNavigationProp, HomeRouteProp } from '../types/navigation';
import * as DB from '../data/db';

interface Props {
  navigation: HomeNavigationProp;
  route: HomeRouteProp;
}

interface State {
  menuVisible: boolean;
  importModalVisible: boolean;
  importText: string;
}

export default class HomeScreen extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { menuVisible: false, importModalVisible: false, importText: '' };
  }

  componentDidMount() {
    const user = this.props.route.params?.user ?? 'local_user';
    DB.initializeDefaultProfiles(user);
    this.props.navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => this.setState({ menuVisible: true })} style={localStyles.hamburgerButton}>
          <Text style={localStyles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
      ),
    });
  }

  navigateToRecord = (calledFrom: 'Record' | 'Analyze') => {
    const user = this.props.route.params?.user ?? 'local_user';
    const { navigate } = this.props.navigation;
    this.setState({ menuVisible: false });
    let navigated = false;
    const promise = DB.getShotProfile(user, (shots) => {
      navigated = true;
      const firstShot = shots[0];
      navigate(calledFrom, {
        user,
        id: firstShot.id,
        shotName: firstShot.name,
        targetDistance: firstShot.distance,
        targetRadius: firstShot.targetRadius,
        missRadius: firstShot.missRadius,
        calledFrom,
      });
    });
    void promise.then(() => {
      if (!navigated) {
        Alert.alert(
          'No Shot Profiles Found',
          'Please create at least one shot profile before recording or analyzing data.',
          [{ text: 'Go to Shot Profile', onPress: () => navigate('ShotProfile', { user }) }, { text: 'Cancel', style: 'cancel' }]
        );
      }
    });
  };

  handleExportCSV = () => {
    const user = this.props.route.params?.user ?? 'local_user';
    this.setState({ menuVisible: false });
    void DB.exportAllDataAsCSV(user).then((csv) => {
      if (Platform.OS === 'web') {
        // On web, trigger a file download via a temporary anchor element
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = (document as Document).createElement('a');
        a.href = url;
        a.download = 'foresight_session.csv';
        (document as Document).body.appendChild(a);
        a.click();
        (document as Document).body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        void Share.share({ message: csv, title: 'foresight_session.csv' });
      }
    }).catch(() => {
      Alert.alert('Export Failed', 'Could not export session data. Please try again.');
    });
  };

  handleImportSession = () => {
    this.setState({ menuVisible: false, importModalVisible: true, importText: '' });
    if (Platform.OS === 'web') {
      // On web, open a file picker to read the CSV file
      const input = (document as Document).createElement('input') as HTMLInputElement;
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target?.result as string;
          if (text) {
            this.setState({ importText: text });
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  handleImportConfirm = () => {
    const user = this.props.route.params?.user ?? 'local_user';
    const { importText } = this.state;
    if (!importText.trim()) {
      Alert.alert('Empty Input', 'Please paste CSV content or select a file to import.');
      return;
    }
    void DB.importFromCSV(user, importText).then(() => {
      this.setState({ importModalVisible: false, importText: '' });
      Alert.alert('Import Successful', 'Session data has been imported.');
    }).catch(() => {
      Alert.alert('Import Failed', 'Could not parse the CSV. Please check the format and try again.');
    });
  };

  render() {
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? 'local_user';
    return (
      <View style={styles.template}>
        {/* Hamburger dropdown menu */}
        <Modal transparent visible={this.state.menuVisible} animationType="fade" onRequestClose={() => this.setState({ menuVisible: false })}>
          <TouchableOpacity style={localStyles.menuOverlay} activeOpacity={1} onPress={() => this.setState({ menuVisible: false })}>
            <View style={localStyles.menuDropdown}>
              <TouchableOpacity style={localStyles.menuItem} onPress={() => { this.setState({ menuVisible: false }); navigate('ShotProfile', { user }); }}>
                <Text style={localStyles.menuItemText}>Shot Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.menuItem} onPress={() => this.navigateToRecord('Record')}>
                <Text style={localStyles.menuItemText}>Record Data</Text>
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.menuItem} onPress={() => this.navigateToRecord('Analyze')}>
                <Text style={localStyles.menuItemText}>Analyze Data</Text>
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.menuItem} onPress={this.handleImportSession}>
                <Text style={localStyles.menuItemText}>Import Session</Text>
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.menuItem} onPress={this.handleExportCSV}>
                <Text style={localStyles.menuItemText}>Export CSV</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Import Session modal */}
        <Modal transparent visible={this.state.importModalVisible} animationType="slide" onRequestClose={() => this.setState({ importModalVisible: false })}>
          <View style={localStyles.importOverlay}>
            <View style={localStyles.importModal}>
              <Text style={localStyles.importTitle}>Import Session CSV</Text>
              <Text style={localStyles.importSubtitle}>
                {Platform.OS === 'web' ? 'File loaded — press Import, or paste CSV below:' : 'Paste CSV content below:'}
              </Text>
              <ScrollView style={localStyles.importScrollView}>
                <TextInput
                  style={localStyles.importTextInput}
                  multiline
                  value={this.state.importText}
                  onChangeText={(text) => this.setState({ importText: text })}
                  placeholder="Paste CSV here..."
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </ScrollView>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.buttonDanger, { margin: 8 }]} onPress={() => this.setState({ importModalVisible: false })}>
                  <Text style={styles.buttonLabel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonSuccess, { margin: 8 }]} onPress={this.handleImportConfirm}>
                  <Text style={styles.buttonLabel}>Import</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.homeContainer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.buttonContainer} onPress={() => navigate('ShotProfile', { user })}>
              <Text style={styles.buttonLabel}>Shot Profile</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.buttonContainer} onPress={() => this.navigateToRecord('Record')}>
              <Text style={styles.buttonLabel}>Record Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonContainer} onPress={() => this.navigateToRecord('Analyze')}>
              <Text style={styles.buttonLabel}>Analyze Data</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.logoutButtonRow}>
            <TouchableOpacity style={styles.logoutButtonContainer} onPress={() => navigate('Login')}>
              <Text style={styles.buttonLabel}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
}

const localStyles = StyleSheet.create({
  hamburgerButton: {
    marginRight: 16,
    padding: 4,
  },
  hamburgerIcon: {
    fontSize: 24,
    color: 'black',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuDropdown: {
    position: 'absolute',
    top: 50,
    right: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    minWidth: 180,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  menuItemText: {
    fontSize: 16,
    color: 'black',
  },
  importOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  importModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  importTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  importSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  importScrollView: {
    maxHeight: 250,
    marginBottom: 12,
  },
  importTextInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
