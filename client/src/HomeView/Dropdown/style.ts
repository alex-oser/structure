import { makeStyles } from "@material-ui/core/styles";

export const useStyles = makeStyles(theme => ({
  dropdownContainer: {
    margin: theme.spacing(1),
    display: "flex",
    justifyContent: "center",
  },
  input: {
    width: 300,
  },
  or: {
    padding: "0 10px 0 10px",
    alignSelf: "center",
  }
}))