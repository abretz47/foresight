import React, { Component } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles, COLORS } from '../styles/styles';
import * as DB from '../data/db';
import { ShotProfile } from '../data/db';
import { RecordDetailsNavigationProp, RecordDetailsRouteProp } from '../types/navigation';

interface Props {
  navigation: RecordDetailsNavigationProp;
  route: RecordDetailsRouteProp;
  defaultSelection?: number;
}

interface State {
  selectedShot: number;
  shots: ShotProfile[];
  id: string;
  shotName: string;
  targetDistance: string;
  targetRadius: string;
  missRadius: string;
}

export default class RecordDetailsScreen extends Component<Props, State> {
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
    };
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('focus', () => {
      this.getShotProfile();
    });
  }

  componentWillUnmount() {
    if (this.focusListener) {
      this.focusListener();
    }
  }

  selectionChange = (index: number) => {
    const selection = this.state.shots[index];
    this.setState({
      id: selection.id,
      shotName: selection.name,
      targetDistance: selection.distance,
      targetRadius: selection.targetRadius,
      missRadius: selection.missRadius,
    });
  };

  getShotProfile = () => {
    const user = this.props.route.params?.user ?? '';
    DB.getShotProfile(user, (data) => {
      this.setState({ shots: data, selectedShot: 0 }, () => {
        this.selectionChange(0);
      });
    });
  };

  render() {
    const { navigate } = this.props.navigation;
    return (
      <View style={[styles.template, { paddingBottom: 20 }]}>
        <View style={{ flex: 1, paddingTop: 8 }}>
          {/* Picker card */}
          <View style={[styles.card, rdStyles.sectionCard]}>
            <Text style={rdStyles.sectionTitle}>Select Shot Type</Text>
            <View style={rdStyles.pickerWrapper}>
              <Picker
                selectedValue={this.state.selectedShot}
                mode="dialog"
                onValueChange={(itemValue) => {
                  this.setState({ selectedShot: itemValue });
                  this.selectionChange(Number(itemValue));
                }}
                style={rdStyles.picker}
              >
                {Object.keys(this.state.shots).map((key) => (
                  <Picker.Item label={this.state.shots[Number(key)].name} value={key} key={key} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Details card */}
          <View style={[styles.card, rdStyles.sectionCard]}>
            <Text style={rdStyles.sectionTitle}>Shot Details</Text>
            <View style={rdStyles.detailRow}>
              <View style={rdStyles.detailCell}>
                <Text style={rdStyles.detailLabel}>Shot Name</Text>
                <Text style={rdStyles.detailValue}>{this.state.shotName || '—'}</Text>
              </View>
              <View style={rdStyles.detailCell}>
                <Text style={rdStyles.detailLabel}>Target Distance</Text>
                <Text style={rdStyles.detailValue}>{this.state.targetDistance || '—'}</Text>
              </View>
            </View>
            <View style={rdStyles.detailRow}>
              <View style={rdStyles.detailCell}>
                <Text style={rdStyles.detailLabel}>Target Radius</Text>
                <Text style={rdStyles.detailValue}>{this.state.targetRadius || '—'}</Text>
              </View>
              <View style={rdStyles.detailCell}>
                <Text style={rdStyles.detailLabel}>Miss Radius</Text>
                <Text style={rdStyles.detailValue}>{this.state.missRadius || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action button */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={() => {
              const calledFrom = this.props.route.params?.calledFrom ?? 'Record';
              const user = this.props.route.params?.user ?? '';
              navigate(calledFrom as 'Record' | 'Analyze', {
                user,
                id: this.state.id,
                shotName: this.state.shotName,
                targetDistance: this.state.targetDistance,
                targetRadius: this.state.targetRadius,
                missRadius: this.state.missRadius,
                calledFrom: 'Home',
              });
            }}
          >
            <Text style={styles.buttonLabelLight}>Let's Go! 🏌️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const rdStyles = StyleSheet.create({
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
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailCell: {
    flex: 1,
    paddingRight: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
