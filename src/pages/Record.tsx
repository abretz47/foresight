import React, { Component } from 'react';
import { TouchableOpacity, Text, View, Button, Dimensions, Switch } from 'react-native';
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
  containerWidth: number;
  containerHeight: number;
  offTarget: boolean;
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
      containerWidth: 0,
      containerHeight: 0,
      offTarget: false,
    };
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('focus', () => {
      const { route } = this.props;
      const shotId = route.params?.id ?? this.state.shotId;
      const targetRadius = route.params?.targetRadius ?? this.state.targetRadius;
      const missRadius = route.params?.missRadius ?? this.state.missRadius;
      this.setState(
        {
          shotId,
          shotName: route.params?.shotName ?? this.state.shotName,
          targetDistance: route.params?.targetDistance ?? this.state.targetDistance,
          targetRadius,
          missRadius,
          targetRadiusPx:
            Math.round(
              Math.round(Dimensions.get('window').width) *
                ((Number(targetRadius) || 1) / (Number(missRadius) || 1)) *
                0.7
            ) / 2,
          missRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * 0.7) / 2,
        },
        () => {
          this.loadData(shotId);
        }
      );
    });
  }

  componentWillUnmount() {
    if (this.focusListener) {
      this.focusListener();
    }
  }

  targetStyle = () => ({
    position: 'absolute' as const,
    left: (this.state.containerWidth - this.state.targetRadiusPx * 2) / 2,
    top: (this.state.containerHeight - this.state.targetRadiusPx * 2) / 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: 'red' as const,
    width: this.state.targetRadiusPx * 2,
    height: this.state.targetRadiusPx * 2,
    borderRadius: this.state.targetRadiusPx,
    zIndex: 2,
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
    position: 'absolute' as const,
    left: (this.state.containerWidth - this.state.missRadiusPx * 2) / 2,
    top: (this.state.containerHeight - this.state.missRadiusPx * 2) / 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    width: this.state.missRadiusPx * 2,
    height: this.state.missRadiusPx * 2,
    backgroundColor: '#FFFFFF' as const,
    borderRadius: this.state.missRadiusPx,
    zIndex: 1,
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
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? '';
    return (
      <View style={styles.template}>
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.smallLabel}>{this.state.shotName} targeted at {this.state.targetDistance}</Text>
          </View>
        </View>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Record</Text>
          <Switch
            value={this.state.calledFrom === 'Analyze'}
            onValueChange={(value) => {
              const calledFrom = value ? 'Analyze' : 'Record';
              this.setState({ calledFrom });
              if (value) {
                const { shotId } = this.state;
                this.loadData(shotId);
              }
            }}
            thumbColor="white"
            trackColor={{ false: '#888', true: '#888' }}
          />
          <Text style={styles.sliderLabel}>Analyze</Text>
        </View>
        <TouchableOpacity
          style={styles.touchableContainer}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== this.state.containerWidth || height !== this.state.containerHeight) {
              this.setState({ containerWidth: width, containerHeight: height });
            }
          }}
          onPress={(evt) => {
            if (this.state.calledFrom === 'Record') {
              const centerX = this.state.containerWidth / 2;
              const centerY = this.state.containerHeight / 2;
              const dx = evt.nativeEvent.locationX - centerX;
              const dy = evt.nativeEvent.locationY - centerY;
              const distFromCenter = Math.sqrt(dx * dx + dy * dy);
              const clickedFrom = distFromCenter <= this.state.targetRadiusPx ? 'target' : 'miss';
              const offTarget = distFromCenter > this.state.missRadiusPx;
              this.setState({
                shotDistance: (
                  Number(this.state.targetDistance) -
                  (dy * Number(this.state.missRadius)) / this.state.missRadiusPx
                ).toFixed(0),
                shotAccuracy: (
                  (dx * Number(this.state.missRadius)) / this.state.missRadiusPx
                ).toFixed(0),
                shotX: evt.nativeEvent.locationX,
                shotY: evt.nativeEvent.locationY,
                clickedFrom,
                offTarget,
                modalVisible: true,
              });
            }
          }}
        >
          {/* Miss circle - back-most element */}
          <View style={this.missStyle()} pointerEvents="none">
            <Text style={styles.circleLabelTop}>
              {(Number(this.state.targetDistance) + Number(this.state.missRadius)).toFixed(0)}
            </Text>
            <Text style={styles.circleLabelBottom}>
              {(Number(this.state.targetDistance) - Number(this.state.missRadius)).toFixed(0)}
            </Text>
          </View>
          {/* Target circle - between miss circle and touchable container */}
          <View style={this.targetStyle()} pointerEvents="none">
            <Text style={styles.circleLabelInnerTop}>
              {(Number(this.state.targetDistance) + Number(this.state.targetRadius)).toFixed(0)}
            </Text>
            <Text style={styles.circleLabelInnerBottom}>
              {(Number(this.state.targetDistance) - Number(this.state.targetRadius)).toFixed(0)}
            </Text>
          </View>
          {/* Horizontal line and label - above target circle on z-axis */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: this.state.containerWidth / 2,
              top: this.state.containerHeight / 2,
              width: this.state.missRadiusPx,
              height: 1,
              backgroundColor: 'black',
              zIndex: 3,
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: this.state.containerWidth / 2 + 50,
              top: this.state.containerHeight / 2 - 16,
              width: this.state.missRadiusPx,
              textAlign: 'center',
              fontSize: 11,
              zIndex: 3,
            }}
          >
            {this.state.missRadius}
          </Text>
          {/* Data points - shown in Analyze mode, positioned relative to the container */}
          {this.state.calledFrom === 'Analyze' &&
            Object.keys(this.state.data).map((key) => {
              const item = this.state.data[Number(key)];
              return <View style={this.dataStyle(item.shotX - 5, item.shotY - 5)} key={key} />;
            })}
        </TouchableOpacity>
        <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
            <Button
              title="Change Shot"
              color="black"
              onPress={() =>
                navigate('RecordDetails', {
                  calledFrom: this.state.calledFrom,
                  user,
                })
              }
            />
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
                      offTarget: this.state.offTarget,
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
