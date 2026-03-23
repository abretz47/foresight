import React, { Component } from 'react';
import { Text, View, TextInput, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as DB from '../data/db';
import { ShotProfile as ShotProfileData, UserProfile } from '../data/db';
import { styles, COLORS } from '../styles/styles';
import { ShotProfileNavigationProp, ShotProfileRouteProp } from '../types/navigation';

interface Props {
  navigation: ShotProfileNavigationProp;
  route: ShotProfileRouteProp;
  defaultSelection?: string | number;
}

interface State {
  selectedShot: string | number;
  shots: ShotProfileData[];
  id: string;
  shotName: string;
  targetDistance: string;
  targetRadius: string;
  missRadius: string;
  units: 'imperial' | 'metric';
  handWidth: string;
  armLength: string;
}

export default class ShotProfile extends Component<Props, State> {
  private focusListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedShot: this.props.defaultSelection,
      shots: [],
      id: '',
      shotName: '',
      targetDistance: '',
      targetRadius: '',
      missRadius: '',
      units: 'imperial',
      handWidth: '',
      armLength: '',
    };
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('focus', () => {
      this.getShotProfile();
      this.loadUserProfile();
    });
  }

  componentWillUnmount() {
    if (this.focusListener) {
      this.focusListener();
    }
  }

  getShotProfile = (retainShotId?: string) => {
    const user = this.props.route.params?.user ?? '';
    // Honour a selectedClubId navigation param when no explicit retainShotId was supplied
    const targetId = retainShotId ?? this.props.route.params?.selectedClubId;
    DB.getShotProfile(user, (data) => {
      if (targetId) {
        const idx = data.findIndex((s) => s.id === targetId);
        if (idx >= 0) {
          const shot = data[idx];
          this.setState({
            shots: data,
            selectedShot: String(idx),
            id: shot.id,
            shotName: shot.name,
            targetDistance: shot.distance,
            targetRadius: shot.targetRadius,
            missRadius: shot.missRadius,
          });
          return;
        }
      }
      this.setState({ shots: data, selectedShot: 'New Shot' });
    });
  };

  selectionChange = (value: string | number, index: number) => {
    if (value !== 'New Shot') {
      const selection = this.state.shots[index - 1];
      this.setState({
        id: selection.id,
        shotName: selection.name,
        targetDistance: selection.distance,
        targetRadius: selection.targetRadius,
        missRadius: selection.missRadius,
      });
    } else {
      this.setState({ id: '', shotName: '', targetDistance: '', targetRadius: '', missRadius: '' });
    }
  };

  saveShot = () => {
    const user = this.props.route.params?.user ?? '';
    const shot = {
      id: this.state.id,
      name: this.state.shotName,
      targetDistance: this.state.targetDistance,
      targetRadius: this.state.targetRadius,
      missRadius: this.state.missRadius,
    };
    if (shot.id && shot.id !== '') {
      DB.hasShotData(shot.id).then((hasData) => {
        if (hasData) {
          Alert.alert(
            'Delete Recorded Data?',
            'Saving changes to this shot profile will delete all recorded shot data for this shot. Do you want to continue?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save & Delete Data',
                style: 'destructive',
                onPress: async () => {
                  await DB.deleteShotData(shot.id);
                  await DB.saveShot(user, shot);
                  this.getShotProfile(shot.id);
                },
              },
            ]
          );
        } else {
          DB.saveShot(user, shot);
          this.getShotProfile(shot.id);
        }
      });
    } else {
      DB.saveShot(user, shot);
      // New club — reload without a retain target (resets to "New Shot")
      this.getShotProfile();
    }
  };

  deleteShot = () => {
    const user = this.props.route.params?.user ?? '';
    DB.deleteShot(user, this.state.id);
    this.getShotProfile();
    this.setState({ id: '', shotName: '', targetDistance: '', targetRadius: '', missRadius: '' });
  };

  loadUserProfile = async () => {
    const user = this.props.route.params?.user ?? '';
    const profile = await DB.getUserProfile(user);
    if (profile) {
      this.setState({
        units: profile.units ?? 'imperial',
        handWidth: profile.handWidth ?? '',
        armLength: profile.armLength ?? '',
      });
    }
  };

  saveMeasurements = async () => {
    const user = this.props.route.params?.user ?? '';
    const existing = (await DB.getUserProfile(user)) ?? {};
    await DB.saveUserProfile(user, {
      ...existing,
      handWidth: this.state.handWidth.trim() || undefined,
      armLength: this.state.armLength.trim() || undefined,
    });
    Alert.alert('Saved', 'Body measurements updated.');
  };

  render() {
    return (
      <KeyboardAwareScrollView
        style={[styles.container, { backgroundColor: COLORS.background }]}
        resetScrollToCoords={{ x: 0, y: 0 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        scrollEnabled={true}
      >
        {/* Shot selector card */}
        <View style={[styles.card, spStyles.sectionCard]}>
          <Text style={spStyles.sectionTitle}>Select Shot</Text>
          <View style={spStyles.pickerWrapper}>
            <Picker
              selectedValue={this.state.selectedShot}
              mode="dialog"
              onValueChange={(itemValue, itemIndex) => {
                this.setState({ selectedShot: itemValue });
                this.selectionChange(itemValue, itemIndex);
              }}
              style={spStyles.picker}
              itemStyle={spStyles.pickerItem}
            >
              <Picker.Item label="New Shot" value="New Shot" />
              {Object.keys(this.state.shots).map((key) => (
                <Picker.Item label={this.state.shots[Number(key)].name} value={key} key={key} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Details card */}
        <View style={[styles.card, spStyles.sectionCard]}>
          <Text style={spStyles.sectionTitle}>Shot Details</Text>
          <View style={spStyles.fieldRow}>
            <View style={spStyles.fieldCol}>
              <Text style={styles.label}>Shot Name</Text>
              <TextInput
                value={this.state.shotName}
                style={styles.textInput}
                onChangeText={(text) => this.setState({ shotName: text })}
                placeholder="e.g. Driver"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={spStyles.fieldCol}>
              <Text style={styles.label}>Target Distance</Text>
              <TextInput
                value={this.state.targetDistance}
                style={styles.textInput}
                onChangeText={(text) => this.setState({ targetDistance: text })}
                placeholder="e.g. 150"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={spStyles.fieldRow}>
            <View style={spStyles.fieldCol}>
              <Text style={styles.label}>Target Radius</Text>
              <TextInput
                value={this.state.targetRadius}
                style={styles.textInput}
                onChangeText={(text) => this.setState({ targetRadius: text })}
                placeholder="e.g. 10"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={spStyles.fieldCol}>
              <Text style={styles.label}>Miss Radius</Text>
              <TextInput
                value={this.state.missRadius}
                style={styles.textInput}
                onChangeText={(text) => this.setState({ missRadius: text })}
                placeholder="e.g. 30"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.buttonDanger} onPress={() => this.deleteShot()}>
            <Text style={styles.buttonLabelLight}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonPrimary} onPress={() => this.saveShot()}>
            <Text style={styles.buttonLabelLight}>Save Shot</Text>
          </TouchableOpacity>
        </View>

        {/* Body measurements card */}
        <View style={[styles.card, spStyles.sectionCard]}>
          <Text style={spStyles.sectionTitle}>Body Measurements</Text>
          <Text style={spStyles.measureHint}>
            Used to reference left/right distances from far away.
          </Text>
          <View style={spStyles.fieldRow}>
            <View style={spStyles.fieldCol}>
              <Text style={styles.label}>
                Hand Width ({this.state.units === 'imperial' ? 'in' : 'cm'})
              </Text>
              <TextInput
                value={this.state.handWidth}
                style={styles.textInput}
                onChangeText={(text) => this.setState({ handWidth: text })}
                placeholder={this.state.units === 'imperial' ? 'e.g. 3.0' : 'e.g. 7.5'}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={spStyles.fieldCol}>
              <Text style={styles.label}>
                Arm Length ({this.state.units === 'imperial' ? 'in' : 'cm'})
              </Text>
              <TextInput
                value={this.state.armLength}
                style={styles.textInput}
                onChangeText={(text) => this.setState({ armLength: text })}
                placeholder={this.state.units === 'imperial' ? 'e.g. 24' : 'e.g. 60'}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
          <TouchableOpacity style={[styles.buttonPrimary, { marginHorizontal: 0 }]} onPress={this.saveMeasurements}>
            <Text style={styles.buttonLabelLight}>Save Measurements</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    );
  }
}

const spStyles = StyleSheet.create({
  sectionCard: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  pickerWrapper: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  picker: {
    color: COLORS.textPrimary,
  },
  pickerItem: {
    fontSize: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
    marginBottom: 4,
  },
  fieldCol: {
    flex: 1,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  measureHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 17,
  },
});
