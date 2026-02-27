import React, { Component } from 'react';
import { Text, View, Button } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles } from '../styles/styles';
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
      <View style={styles.template}>
        <View style={styles.container}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Select Shot Type</Text>
              <Picker
                selectedValue={this.state.selectedShot}
                mode="dialog"
                onValueChange={(itemValue) => {
                  this.setState({ selectedShot: itemValue });
                  this.selectionChange(Number(itemValue));
                }}
              >
                {Object.keys(this.state.shots).map((key) => (
                  <Picker.Item label={this.state.shots[Number(key)].name} value={key} key={key} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Shot Name</Text>
              <Text>{this.state.shotName}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Target Distance</Text>
              <Text>{this.state.targetDistance}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Target Radius</Text>
              <Text>{this.state.targetRadius}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Miss Radius</Text>
              <Text>{this.state.missRadius}</Text>
            </View>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
            <Button
              title="Go!"
              color="black"
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
            />
          </View>
        </View>
      </View>
    );
  }
}
