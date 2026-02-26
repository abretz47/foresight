import React, { Component } from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles } from '../styles/styles';

interface Props {
  defaultSelection?: string;
  callBack: (key: string, value: string) => void;
}

interface State {
  missRadius: string;
}

export default class MissRadiusPicker extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { missRadius: this.props.defaultSelection ?? '' };
  }

  render() {
    return (
      <View>
        <Text style={styles.label}>Miss</Text>
        <Text style={styles.label}>Radius</Text>
        <Picker
          selectedValue={this.state.missRadius}
          style={{ flex: 1 }}
          onValueChange={(itemValue) => {
            this.setState({ missRadius: String(itemValue) });
            this.props.callBack('missRadius', String(itemValue));
          }}
        >
          {Array.from({ length: 26 }, (_, i) => i + 5).map((n) => (
            <Picker.Item key={n} label={String(n)} value={String(n)} />
          ))}
        </Picker>
      </View>
    );
  }
}
