import React, { Component } from 'react';
import { TouchableOpacity, Text, View, Button, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { styles } from '../styles/styles';
import * as DB from '../data/db';
import { DataPoint } from '../data/db';
import { RecordNavigationProp, RecordRouteProp } from '../types/navigation';

interface Props {
  navigation: RecordNavigationProp;
  route: RecordRouteProp;
}

interface State {
  screenWidth: number;
  screenHeight: number;
  shotName: string;
  targetDistance: string;
  targetRadius: string;
  missRadius: string;
  targetRadiusPx: number;
  missRadiusPx: number;
  modalVisible: boolean;
  clickedFrom: string;
  shotDistance: string;
  shotAccuracy: string;
  shotX: number | string;
  shotY: number | string;
  data: DataPoint[];
  shotId: string;
  calledFrom: string;
}

export default class Record extends Component<Props, State> {
  private focusListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    const { route } = this.props;
    this.state = {
      screenWidth: Math.round(Dimensions.get('window').width),
      screenHeight: Math.round(Dimensions.get('window').height),
      shotName: route.params?.shotName ?? '--',
      targetDistance: route.params?.targetDistance ?? '--',
      targetRadius: route.params?.targetRadius ?? '--',
      missRadius: route.params?.missRadius ?? '--',
      targetRadiusPx:
        Math.round(
          Math.round(Dimensions.get('window').width) *
            ((Number(route.params?.targetRadius) || 1) / (Number(route.params?.missRadius) || 1)) *
            0.7
        ) / 2,
      missRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * 0.7) / 2,
      modalVisible: false,
      clickedFrom: '',
      shotDistance: '',
      shotAccuracy: '',
      shotX: '',
      shotY: '',
      data: [],
      shotId: route.params?.id ?? '--',
      calledFrom: route.params?.calledFrom ?? 'Default',
    };
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('focus', () => {
      this.loadData(this.state.shotId);
    });
  }

  componentWillUnmount() {
    if (this.focusListener) {
      this.focusListener();
    }
  }

  targetStyle = () => ({
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: 'red' as const,
    width: (this.state.missRadiusPx / Number(this.state.missRadius)) * Number(this.state.targetRadius) * 2,
    height: (this.state.missRadiusPx / Number(this.state.missRadius)) * Number(this.state.targetRadius) * 2,
    borderRadius: this.state.targetRadiusPx,
  });

  dataStyle = (left: number, top: number) => ({
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: 'black' as const,
    width: 10,
    height: 10,
    position: 'absolute' as const,
    left,
    top,
    borderRadius: 5,
    zIndex: 1000,
  });

  missStyle = () => ({
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    width: this.state.missRadiusPx * 2,
    height: this.state.missRadiusPx * 2,
    backgroundColor: '#FFFFFF' as const,
    borderRadius: this.state.missRadiusPx,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  missButtonContainer = () => ({
    borderRadius: this.state.missRadiusPx,
  });

  convertShotAccuracy = (number: string | number) => {
    const absVal = Math.abs(Number(number));
    if (Number(number) <= 0) {
      return String(absVal) + ' Left';
    } else {
      return String(absVal) + ' Right';
    }
  };

  loadData = (id: string) => {
    const user = this.props.route.params?.user ?? '';
    DB.getShotData(user, id, (data) => {
      this.setState({ data });
    });
  };

  render() {
    return (
      <View style={styles.template}>
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.smallLabel}>{this.state.shotName} targeted at {this.state.targetDistance}</Text>
          </View>
        </View>
        <View style={styles.touchableContainer}>
          <View style={styles.row}>
            <View style={this.missButtonContainer()}>
              <TouchableOpacity
                style={this.missStyle()}
                onPress={(evt) => {
                  if (this.state.calledFrom === 'Record') {
                    this.setState({
                      shotDistance: (
                        Number(this.state.targetDistance) -
                        ((evt.nativeEvent.locationY - this.state.missRadiusPx) * Number(this.state.missRadius)) /
                          this.state.missRadiusPx
                      ).toFixed(0),
                      shotAccuracy: (
                        ((evt.nativeEvent.locationX - this.state.missRadiusPx) * Number(this.state.missRadius)) /
                        this.state.missRadiusPx
                      ).toFixed(0),
                      shotX: evt.nativeEvent.locationX,
                      shotY: evt.nativeEvent.locationY,
                      clickedFrom: 'miss',
                      modalVisible: true,
                    });
                  }
                }}
              >
                <Text style={styles.circleLabelTop}>
                  {(Number(this.state.targetDistance) + Number(this.state.missRadius)).toFixed(0)}
                </Text>
                <View>
                  {Object.keys(this.state.data).map((key) => {
                    const item = this.state.data[Number(key)];
                    if (this.state.calledFrom === 'Analyze' && item.clickedFrom === 'miss') {
                      return (
                        <TouchableOpacity
                          style={this.dataStyle(item.shotX - this.state.missRadiusPx, item.shotY - this.state.targetRadiusPx)}
                          key={key}
                        />
                      );
                    }
                    return null;
                  })}
                </View>
                <TouchableOpacity
                  style={this.targetStyle()}
                  onPress={(evt) => {
                    if (this.state.calledFrom === 'Record') {
                      this.setState({
                        shotDistance: (
                          Number(this.state.targetDistance) -
                          ((evt.nativeEvent.locationY - this.state.targetRadiusPx) * Number(this.state.targetRadius)) /
                            this.state.targetRadiusPx
                        ).toFixed(0),
                        shotAccuracy: (
                          ((evt.nativeEvent.locationX - this.state.targetRadiusPx) * Number(this.state.targetRadius)) /
                          this.state.targetRadiusPx
                        ).toFixed(0),
                        shotX: evt.nativeEvent.locationX,
                        shotY: evt.nativeEvent.locationY,
                        clickedFrom: 'target',
                        modalVisible: true,
                      });
                    }
                  }}
                >
                  <Text style={styles.circleLabelInnerTop}>
                    {(Number(this.state.targetDistance) + Number(this.state.targetRadius)).toFixed(0)}
                  </Text>
                  <View>
                    {Object.keys(this.state.data).map((key) => {
                      const item = this.state.data[Number(key)];
                      if (this.state.calledFrom === 'Analyze' && item.clickedFrom === 'target') {
                        return (
                          <TouchableOpacity
                            style={this.dataStyle(item.shotX, item.shotY)}
                            key={key}
                          />
                        );
                      }
                      return null;
                    })}
                  </View>
                  <Text style={styles.circleLabelInnerBottom}>
                    {(Number(this.state.targetDistance) - Number(this.state.targetRadius)).toFixed(0)}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    position: 'absolute',
                    left: this.state.missRadiusPx + 50,
                    top: this.state.missRadiusPx - 16,
                    width: this.state.missRadiusPx,
                    textAlign: 'center',
                    fontSize: 11,
                  }}
                >
                  {this.state.missRadius}
                </Text>
                <View
                  style={{
                    position: 'absolute',
                    left: this.state.missRadiusPx,
                    top: this.state.missRadiusPx,
                    width: this.state.missRadiusPx,
                    height: 1,
                    backgroundColor: 'black',
                  }}
                />
                <Text style={styles.circleLabelBottom}>
                  {(Number(this.state.targetDistance) - Number(this.state.missRadius)).toFixed(0)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Modal isVisible={this.state.modalVisible}>
          <View style={styles.modalContent}>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Distance</Text>
                <Text>{this.state.shotDistance}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Accuracy</Text>
                <Text>{this.convertShotAccuracy(this.state.shotAccuracy)}</Text>
              </View>
            </View>
            <View style={styles.buttonRow}>
              <View style={styles.buttonDanger}>
                <Button
                  color="black"
                  title="Cancel"
                  onPress={() => this.setState({ modalVisible: false })}
                />
              </View>
              <View style={styles.buttonSuccess}>
                <Button
                  title="Ok!"
                  color="black"
                  onPress={() => {
                    const user = this.props.route.params?.user ?? '';
                    DB.saveDataPoint(user, {
                      id: this.state.shotId,
                      shotX: Number(this.state.shotX),
                      shotY: Number(this.state.shotY),
                      clickedFrom: this.state.clickedFrom,
                      screenHeight: this.state.screenHeight,
                      screenWidth: this.state.screenWidth,
                    });
                    this.setState({ modalVisible: false });
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }
}
